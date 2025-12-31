"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import "@/app/styles/vendor/frappe-gantt.css";

// --- Minimal types ---
type WsMember = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  profiles?: { email?: string | null; full_name?: string | null };
};

type TodoRow = {
  id: string;
  title: string;
  project_id: string;
};

type ProjectRow = {
  id: string;
  name: string;
};

type GanttTask = {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  custom_class?: string; // must be single token
};

// View rows
type TodoWindowRow = {
  todo_id: string | null;
  project_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
};

type ProjectWindowRow = {
  project_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
};

// -------------------- Helpers --------------------
function labelForMember(m: WsMember) {
  const name = (m.profiles?.full_name ?? "").trim();
  const email = (m.profiles?.email ?? "").trim();
  return name || email || m.user_id;
}

function isoToUtcDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addOneDay(date: Date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// -------------------- Page --------------------
export default function GanttPage() {
  const router = useRouter();

  const [baseLoading, setBaseLoading] = useState(true);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<WsMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const ganttRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = workspaceRole === "owner" || workspaceRole === "admin";

  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

  const ganttHeight = useMemo(() => {
    const rowHeight = 36;
    const header = 120;
    const padding = 40;
    const min = 260;
    return Math.max(min, header + padding + tasks.length * rowHeight);
  }, [tasks.length]);

  async function loadBase() {
    setBaseLoading(true);
    setLoadError(null);

    try {
      const user = await requireUser(router);
      if (!user) return;
      setMyUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        setLoadError("No active workspace found.");
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
        console.error(memErr);
        setLoadError(memErr.message);
        return;
      }

      const list = (((mem as any) ?? []) as WsMember[]).filter((m) => !!m.user_id);
      setMembers(list);

      const selfInList = list.find((m) => m.user_id === user.id)?.user_id;
      const initial = selfInList ?? list[0]?.user_id ?? user.id;
      setSelectedUserId((prev) => prev || initial);
    } catch (e: any) {
      console.error("loadBase failed:", e);
      setLoadError(String(e?.message ?? e));
    } finally {
      setBaseLoading(false);
    }
  }

  async function loadGanttData(wsId: string, uid: string) {
    setGanttLoading(true);
    setLoadError(null);

    try {
      // 1) Todo windows (view)
      const { data: todoWin, error: todoErr } = await supabase
        .from("time_entries_todo_window")
        .select("todo_id,project_id,start_date,end_date")
        .eq("workspace_id", wsId)
        .eq("user_id", uid);

      if (todoErr) {
        console.error(todoErr);
        setLoadError(todoErr.message);
        setTasks([]);
        return;
      }

      const todoWindows = ((todoWin as any) ?? []) as TodoWindowRow[];
      const todoIds = todoWindows.map((r) => r.todo_id).filter(Boolean) as string[];
      if (todoIds.length === 0) {
        setTasks([]);
        return;
      }

      // 2) Project windows (view)
      const { data: projWin, error: projErr } = await supabase
        .from("time_entries_project_window")
        .select("project_id,start_date,end_date")
        .eq("workspace_id", wsId)
        .eq("user_id", uid);

      if (projErr) {
        console.error(projErr);
        setLoadError(projErr.message);
        setTasks([]);
        return;
      }

      const projectWindows = ((projWin as any) ?? []) as ProjectWindowRow[];

      // 3) Todos
      const { data: td, error: tdErr } = await supabase
        .from("todos")
        .select("id,title,project_id")
        .in("id", todoIds);

      if (tdErr) {
        console.error(tdErr);
        setLoadError(tdErr.message);
        setTasks([]);
        return;
      }

      const todos = ((td as any) ?? []) as TodoRow[];
      const todoById = new Map<string, TodoRow>(todos.map((t) => [t.id, t]));

      // 4) Projects
      const projectIds = Array.from(new Set(projectWindows.map((p) => p.project_id))) as string[];

      let projectById = new Map<string, ProjectRow>();
      if (projectIds.length > 0) {
        const { data: pr, error: prErr } = await supabase
          .from("projects")
          .select("id,name")
          .in("id", projectIds);

        if (!prErr) {
          const projects = ((pr as any) ?? []) as ProjectRow[];
          projectById = new Map(projects.map((p) => [p.id, p]));
        }
      }

      // 5) Build tasksByProject with RAW dates (no +1 here!)
      const tasksByProject = new Map<string, Array<{ todoId: string; title: string; start: string; end: string }>>();

      for (const row of todoWindows) {
        if (!row.todo_id) continue;
        const todo = todoById.get(row.todo_id);
        if (!todo) continue;

        const start = row.start_date;
        const end = row.end_date;
        if (!start || !end) continue;

        const list = tasksByProject.get(todo.project_id) ?? [];
        list.push({
          todoId: todo.id,
          title: todo.title,
          start,
          end,
        });
        tasksByProject.set(todo.project_id, list);
      }

      // Sort projects by earliest start
      const projOrder = projectWindows
        .filter((p) => tasksByProject.has(p.project_id))
        .sort((a, b) => {
          if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
          return a.project_id.localeCompare(b.project_id);
        });

      // 6) Build final gantt tasks
      const ganttTasks: GanttTask[] = [];

      for (const pw of projOrder) {
        const pid = pw.project_id;
        const projName = projectById.get(pid)?.name ?? "Project";

        if (!pw.start_date || !pw.end_date) continue;

        const pStartDate = isoToUtcDate(pw.start_date);
        const pEndDate = addOneDay(isoToUtcDate(pw.end_date)); // +1 once here

        ganttTasks.push({
          id: `project:${pid}`,
          name: projName,
          start: pStartDate,
          end: pEndDate,
          progress: 0,
          custom_class: "gantt-project",
        });

        const list = tasksByProject.get(pid) ?? [];
        list.sort((a, b) => {
          if (a.start !== b.start) return a.start < b.start ? -1 : 1;
          return a.title.localeCompare(b.title);
        });

        for (const t of list) {
          if (!t.start || !t.end) continue;

          const tStartDate = isoToUtcDate(t.start);
          const tEndDate = addOneDay(isoToUtcDate(t.end)); // +1 once here

          ganttTasks.push({
            id: t.todoId,
            name: `• ${t.title}`,
            start: tStartDate,
            end: tEndDate,
            progress: 0,
            custom_class: "gantt-task",
          });
        }
      }

      setTasks(ganttTasks);
    } catch (e: any) {
      console.error("loadGanttData failed:", e);
      setLoadError(String(e?.message ?? e));
      setTasks([]);
    } finally {
      setGanttLoading(false);
    }
  }

  // Load base
  useEffect(() => {
    loadBase();
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

  // Render chart whenever tasks change
  useEffect(() => {
    if (!ganttRef.current) return;

    async function render() {
      try {
        const mod: any = await import("frappe-gantt");
        const Gantt = mod?.default ?? mod;

        ganttRef.current!.innerHTML = "";

        if (!tasks || tasks.length === 0) {
          ganttRef.current!.innerHTML =
            '<div class="text-sm text-gray-500 p-4">No planned tasks for this user.</div>';
          return;
        }

        requestAnimationFrame(() => {
          // eslint-disable-next-line no-new
          new Gantt(ganttRef.current, tasks, {
            view_mode: "Week",
            bar_height: 20,
            padding: 16,
          });
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

  if (baseLoading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
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
              Bars run from <span className="font-medium">first logged day</span> to{" "}
              <span className="font-medium">last logged day</span> (based on Hours).
            </div>
            <div className="text-xs text-gray-500">
              {ganttLoading ? "Loading gantt…" : `Loaded for ${selectedLabel || "selected user"}.`}
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

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
        Note: Simplified MVP (no progress). Uses database aggregation for speed.
      </div>
    </main>
  );
}
