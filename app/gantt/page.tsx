// app/gantt/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

import "@/app/styles/vendor/frappe-gantt.css";


// ---- Types (keep minimal for MVP) ----
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

function labelForMember(m: WsMember) {
  const name = (m.profiles?.full_name ?? "").trim();
  const email = (m.profiles?.email ?? "").trim();
  return name || email || m.user_id;
}

function addOneDayISO(yyyyMmDd: string) {
  // Frappe Gantt treats end as exclusive-ish in some views; adding 1 day makes single-day tasks visible.
  // Safe and simple for read-only MVP.
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

  // Visible user options:
  // - owner/admin: can pick anyone in workspace
  // - others: forced to self (read-only for own plan)
  
  const ganttHeight = useMemo(() => {
  const rowHeight = 38;
  const header = 120;
  const padding = 40;
  const min = 260;
  return Math.max(min, header + padding + tasks.length * rowHeight);
}, [tasks.length]);

  
  
  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  async function loadBase() {
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
      setLoading(false);
      setLoadError("No active workspace found.");
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setWorkspaceRole(ws.role);

    // Load workspace members for the user filter
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,user_id,role,profiles(email,full_name)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      console.error(memErr);
      setMembers([]);
      setLoadError(memErr.message);
      setLoading(false);
      return;
    }

    const list = (((mem as any) ?? []) as WsMember[]).filter((m) => !!m.user_id);
    setMembers(list);

    // Default selection:
    // - admin: self (if present), else first member
    // - non-admin: self
    const selfInList = list.find((m) => m.user_id === user.id)?.user_id;
    const initial = selfInList ?? list[0]?.user_id ?? user.id;
    setSelectedUserId(initial);

    setLoading(false);
  }

  async function loadGanttData(wsId: string, uid: string) {
    setLoadError(null);

    // 1) Load all planned entries for this workspace + user
    // Note: For very large datasets you’ll want date-range or server-side aggregation (v2).
    const { data: entries, error: eErr } = await supabase
      .from("time_entries")
      .select("todo_id,project_id,entry_date,minutes")
      .eq("workspace_id", wsId)
      .eq("user_id", uid)
      .order("entry_date", { ascending: true });

    if (eErr) {
      console.error(eErr);
      setTasks([]);
      setLoadError(eErr.message);
      return;
    }

    const rows = ((entries as any) ?? []) as TimeEntryRow[];
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

    // 2) Load todo titles + project name (minimal fields)
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,project_id,projects(name)")
      .in("id", todoIds);

    if (tdErr) {
      console.error(tdErr);
      setTasks([]);
      setLoadError(tdErr.message);
      return;
    }

    const todos = ((td as any) ?? []) as TodoRow[];
    const todoById = new Map<string, TodoRow>();
    for (const t of todos) todoById.set(t.id, t);

    // 3) Load executed totals for progress (you already use this view elsewhere)
    const { data: ex, error: exErr } = await supabase
      .from("todo_executed_totals")
      .select("todo_id,executed_minutes")
      .in("todo_id", todoIds);

    if (exErr) console.warn("Load todo_executed_totals failed:", exErr);

    const execByTodo = new Map<string, number>();
    for (const r of (((ex as any) ?? []) as ExecRow[])) {
      execByTodo.set(r.todo_id, r.executed_minutes ?? 0);
    }

    // 4) Build Gantt tasks
    const ganttTasks: GanttTask[] = todoIds
      .map((id) => {
        const agg = byTodo.get(id)!;
        const todo = todoById.get(id);
        if (!todo) return null;

        const projectName = todo.projects?.name ?? "Project";
        const name = `${projectName} • ${todo.title}`;

        const planned = Math.max(0, agg.plannedMinutes);
        const executed = Math.max(0, execByTodo.get(id) ?? 0);
        const progress = planned > 0 ? Math.min(100, Math.round((executed / planned) * 100)) : 0;

        // Add +1 day to end so that a single-day planned task renders with visible width
        const endPlus = addOneDayISO(agg.max);

        return {
          id,
          name,
          start: agg.min,
          end: endPlus,
          progress,
          // Optional: custom CSS class (for future styling)
          custom_class: progress >= 100 ? "gantt-done" : "gantt-open",
        };
      })
      .filter(Boolean) as GanttTask[];

    // Sort: earliest first
    ganttTasks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    setTasks(ganttTasks);
  }

  // Load base (workspace + members)
  useEffect(() => {
    loadBase();
    // reload when workspace changes
    const handler = () => loadBase();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load gantt data when selection changes
  useEffect(() => {
    if (!workspaceId || !selectedUserId) return;
    loadGanttData(workspaceId, selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, selectedUserId]);

  // Render Frappe Gantt when tasks change
  useEffect(() => {
    if (!ganttRef.current) return;

    async function render() {
      // Dynamic import: avoids SSR issues
      const mod = await import("frappe-gantt");
      const Gantt = (mod as any).default;

      // Clear previous render
      ganttRef.current!.innerHTML = "";

      if (!tasks || tasks.length === 0) {
        ganttRef.current!.innerHTML =
          '<div class="text-sm text-gray-500 p-4">No planned tasks for this user.</div>';
        return;
      }

      // eslint-disable-next-line no-new
      new Gantt(ganttRef.current, tasks, {
        view_mode: "Week",
        bar_height: 22,
        padding: 18,
        // read-only MVP
        on_click: (task: any) => {
          // optional: jump to project/todo later
          console.log("Clicked:", task);
        },
      });
    }

    render();
  }, [tasks]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

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
              disabled={!isAdmin} // non-admin -> self only
            >
              {userOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {labelForMember(m)} ({m.role})
                </option>
              ))}
            </select>
            {!isAdmin ? (
              <div className="text-xs text-gray-500">
                You can only view your own planning in this workspace.
              </div>
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
              Progress is based on executed minutes vs planned minutes in that window.
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      {/* Gantt canvas */}
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
        Note: This is read-only MVP. For large workspaces, we’ll add date-range and server-side aggregation.
      </div>
    </main>
  );
}
