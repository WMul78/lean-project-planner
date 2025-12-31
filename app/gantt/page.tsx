"use client";

import "@/app/styles/vendor/frappe-gantt.css";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

/**
 * Notes:
 * - This page is read-only.
 * - Bars represent planned window from first planned day to last planned day (based on time_entries).
 * - Progress is executed_minutes / planned_minutes (within the loaded entries window).
 * - Projects are grouped: a project header row + its tasks below.
 */

// -------------------- Types --------------------
type WsMember = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  profiles?: { email?: string | null; full_name?: string | null };
};

type TimeEntryRow = {
  todo_id: string | null;
  project_id: string;
  entry_date: string; // YYYY-MM-DD
  minutes: number;
};

type TodoRow = {
  id: string;
  title: string;
  project_id: string;
  projects?: { name?: string | null } | null;
};

type ExecRow = { todo_id: string; executed_minutes: number | null };

// Frappe Gantt task shape
type GanttTask = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number; // 0..100
  custom_class?: string;
};

// -------------------- Helpers --------------------
function labelForMember(m: WsMember) {
  const name = (m.profiles?.full_name ?? "").trim();
  const email = (m.profiles?.email ?? "").trim();
  return name || email || m.user_id;
}

function addOneDayISO(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// stable "calm but distinct" colors per project
const PROJECT_COLORS = ["blue", "green", "purple", "amber", "teal", "indigo"] as const;

function projectColorKey(projectId: string) {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash + projectId.charCodeAt(i)) % PROJECT_COLORS.length;
  }
  return PROJECT_COLORS[hash]; // "blue" | "green" | ...
}


// -------------------- Page --------------------
export default function GanttPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<WsMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const ganttRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = workspaceRole === "owner" || workspaceRole === "admin";

  // Dynamic height: project headers + tasks => more rows => more height
  const ganttHeight = useMemo(() => {
    const rowHeight = 38;
    const header = 120;
    const padding = 40;
    const min = 260;
    return Math.max(min, header + padding + tasks.length * rowHeight);
  }, [tasks.length]);

  // Visible user options:
  // - owner/admin: can pick anyone in workspace
  // - others: only self
  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

  // -------------------- Load base context (auth + workspace + members) --------------------
  const loadBase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }
    setMyUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      setLoadError("No active workspace found.");
      setLoading(false);
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setWorkspaceRole(ws.role);

    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,user_id,role,profiles(email,full_name)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      console.error("Load members error:", memErr);
      setMembers([]);
      setLoadError(memErr.message);
      setLoading(false);
      return;
    }

    const list = (((mem as any) ?? []) as WsMember[]).filter((m) => !!m.user_id);
    setMembers(list);

    const selfInList = list.find((m) => m.user_id === user.id)?.user_id;
    const initial = selfInList ?? list[0]?.user_id ?? user.id;

    setSelectedUserId((prev) => prev || initial);
    setLoading(false);
  }, [router]);

  // -------------------- Load gantt data --------------------
  const loadGanttData = useCallback(async (wsId: string, uid: string) => {
    setLoadError(null);

    // 1) time_entries (planning) for workspace+user
    const { data: entries, error: eErr } = await supabase
      .from("time_entries")
      .select("todo_id,project_id,entry_date,minutes")
      .eq("workspace_id", wsId)
      .eq("user_id", uid)
      .order("entry_date", { ascending: true });

    if (eErr) {
      console.error("Load time_entries error:", eErr);
      setTasks([]);
      setLoadError(eErr.message);
      return;
    }

    const rows = ((entries as any) ?? []) as TimeEntryRow[];

    // Aggregate by todo -> min/max planned date + planned minutes
    const byTodo = new Map<
      string,
      { min: string; max: string; plannedMinutes: number; projectId: string }
    >();

    for (const r of rows) {
      if (!r.todo_id) continue;
      const id = r.todo_id;
      const cur = byTodo.get(id);
      const date = r.entry_date;
      const minutes = r.minutes ?? 0;

      if (!cur) {
        byTodo.set(id, { min: date, max: date, plannedMinutes: minutes, projectId: r.project_id });
      } else {
        if (date < cur.min) cur.min = date;
        if (date > cur.max) cur.max = date;
        cur.plannedMinutes += minutes;
      }
    }

    const todoIds = Array.from(byTodo.keys());
    if (todoIds.length === 0) {
      setTasks([]);
      return;
    }

    // 2) Load todos + project name
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,project_id,projects(name)")
      .in("id", todoIds);

    if (tdErr) {
      console.error("Load todos error:", tdErr);
      setTasks([]);
      setLoadError(tdErr.message);
      return;
    }

    const todos = ((td as any) ?? []) as TodoRow[];
    const todoById = new Map<string, TodoRow>();
    for (const t of todos) todoById.set(t.id, t);

    // 3) Executed totals for progress
    const { data: ex, error: exErr } = await supabase
      .from("todo_executed_totals")
      .select("todo_id,executed_minutes")
      .in("todo_id", todoIds);

    if (exErr) {
      console.warn("Load todo_executed_totals failed:", exErr);
    }

    const execByTodo = new Map<string, number>();
    for (const r of (((ex as any) ?? []) as ExecRow[])) {
      execByTodo.set(r.todo_id, r.executed_minutes ?? 0);
    }

    // 4) Group tasks by project (project header + tasks)
    type ProjectGroup = {
      projectId: string;
      projectName: string;
      items: Array<{
        todoId: string;
        todoTitle: string;
        start: string;
        end: string; // +1 day applied
        progress: number;
      }>;
      minStart: string;
      maxEnd: string;
    };

    const groupsMap = new Map<string, ProjectGroup>();

    for (const todoId of todoIds) {
      const agg = byTodo.get(todoId);
      const todo = todoById.get(todoId);
      if (!agg || !todo) continue;

      const projectId = todo.project_id;
      const projectName = todo.projects?.name ?? "Project";

      const start = agg.min;
      const end = addOneDayISO(agg.max);

      const planned = Math.max(0, agg.plannedMinutes);
      const executed = Math.max(0, execByTodo.get(todoId) ?? 0);
      const progress =
        planned > 0 ? Math.min(100, Math.round((executed / planned) * 100)) : 0;

      if (!groupsMap.has(projectId)) {
        groupsMap.set(projectId, {
          projectId,
          projectName,
          items: [],
          minStart: start,
          maxEnd: end,
        });
      }

      const g = groupsMap.get(projectId)!;
      g.items.push({ todoId, todoTitle: todo.title, start, end, progress });

      if (start < g.minStart) g.minStart = start;
      if (end > g.maxEnd) g.maxEnd = end;
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.minStart !== b.minStart) return a.minStart < b.minStart ? -1 : 1;
      return a.projectName.localeCompare(b.projectName);
    });

    const ganttTasks: GanttTask[] = [];

    for (const g of groups) {
      const color = projectColorKey(g.projectId);

    ganttTasks.push({
      id: `project:${g.projectId}`,
      name: g.projectName,
      start: g.minStart,
      end: g.maxEnd,
      progress: 0,
      custom_class: `gantt-header-${color}`,
    });


      g.items.sort((x, y) => {
        if (x.start !== y.start) return x.start < y.start ? -1 : 1;
        return x.todoTitle.localeCompare(y.todoTitle);
      });

      for (const it of g.items) {
        ganttTasks.push({
          id: it.todoId,
          name: `• ${it.todoTitle}`,
          start: it.start,
          end: it.end,
          progress: it.progress,
          custom_class: `gantt-task-${color}`,
        });
      }
    }

    setTasks(ganttTasks);
  }, []);

  // -------------------- Effects --------------------
  useEffect(() => {
    loadBase();
    const handler = () => loadBase();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [loadBase]);

  useEffect(() => {
    if (!workspaceId || !selectedUserId) return;
    loadGanttData(workspaceId, selectedUserId);
  }, [workspaceId, selectedUserId, loadGanttData]);

  // Render chart whenever tasks change
  useEffect(() => {
    if (!ganttRef.current) return;

    async function render() {
      try {
        const mod: any = await import("frappe-gantt");
        const Gantt = mod?.default ?? mod; // robust for different export styles

        // clear
        ganttRef.current!.innerHTML = "";

        if (!tasks || tasks.length === 0) {
          ganttRef.current!.innerHTML =
            '<div class="text-sm text-gray-500 p-4">No planned tasks for this user.</div>';
          return;
        }

        if (!Gantt) {
          ganttRef.current!.innerHTML =
            '<div class="text-sm text-red-600 p-4">Gantt library failed to load.</div>';
          return;
        }

        // eslint-disable-next-line no-new
        new Gantt(ganttRef.current, tasks, {
          view_mode: "Week",
          bar_height: 22,
          padding: 18,
          on_click: (task: any) => console.log("Clicked:", task),
        });
      } catch (e: any) {
        console.error("Render Gantt failed:", e);
        if (ganttRef.current) {
          ganttRef.current.innerHTML = `<div class="text-sm text-red-600 p-4">
            Render failed: ${String(e?.message ?? e)}
          </div>`;
        }
      }
    }

    render();
  }, [tasks]);

  // -------------------- UI --------------------
  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Gantt</h1>
          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>
          <div className="text-sm text-gray-500">Role: {workspaceRole}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">User</label>
            <select
              className="border rounded-md px-3 py-2"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={!isAdmin}
            >
              {userOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {labelForMember(m)} ({m.role})
                </option>
              ))}
            </select>

            {!isAdmin ? (
              <div className="text-xs text-gray-500">You can only view your own planning.</div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">What you see</label>
            <div className="text-sm text-gray-700">
              Bars run from <span className="font-medium">first planned day</span> to{" "}
              <span className="font-medium">last planned day</span> for{" "}
              <span className="font-medium">{selectedLabel || "selected user"}</span>.
            </div>
            <div className="text-xs text-gray-500">
              Projects are grouped. Progress is executed vs planned minutes.
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      {/* Gantt canvas */}
      <section className="mt-6 border rounded-lg bg-white">
        <div className="overflow-x-auto">
          <div
            ref={ganttRef}
            className="gantt-container min-w-[900px] p-2"
            style={{ height: ganttHeight }}
          />
        </div>
      </section>

      <div className="mt-3 text-xs text-gray-500">
        Note: Read-only MVP. For large workspaces, we’ll add date-range and server-side aggregation.
      </div>
    </main>
  );
}
