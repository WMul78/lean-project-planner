"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
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

type ProjectStatus = "proposed" | "active" | "done" | "archived";

type TodoRow = {
  id: string;
  title: string;
  project_id: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
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
  end_date: string; // YYYY-MM-DD
};

type ProjectWindowRow = {
  project_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
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

function measureSvgHeight(container: HTMLDivElement): number | null {
  const svg = container.querySelector("svg") as SVGSVGElement | null;
  if (!svg) return null;

  try {
    // getBBox gives the true content bounds, even if something is clipped/scrollable.
    const bbox = svg.getBBox();
    const h = Math.ceil(bbox.y + bbox.height);
    // buffer for bottom labels/scrollbar area
    return Math.max(420, h + 40);
  } catch {
    // getBBox can throw if SVG isn't ready yet
    return null;
  }
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

  // NEW: ref to the horizontal scroll container
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = workspaceRole === "owner" || workspaceRole === "admin";
  const [measuredHeight, setMeasuredHeight] = useState<number>(520);

  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

  const ganttHeight = measuredHeight;

  function centerTodayInView() {
    const scroller = scrollRef.current;
    const container = ganttRef.current;
    if (!scroller || !container) return;

    // In your CSS this is the vertical today line:
    // .gantt-container .current-highlight { ... } :contentReference[oaicite:1]{index=1}
    const todayEl = container.querySelector(".current-highlight") as Element | null;
    if (!todayEl) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const todayRect = todayEl.getBoundingClientRect();

    // Today X inside the scroller content
    const todayCenterX = todayRect.left - scrollerRect.left + todayRect.width / 2;

    // Scroll so that today is centered
    const targetScrollLeft = scroller.scrollLeft + (todayCenterX - scroller.clientWidth / 2);

    // Clamp
    const max = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollLeft = Math.max(0, Math.min(max, targetScrollLeft));
  }

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

  async function loadGanttData(pWorkspaceId: string, pUserId: string) {
    setGanttLoading(true);
    setLoadError(null);

    try {
      // 1) Load projects (we need status to hide proposed/archived)
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,name,status")
        .eq("workspace_id", pWorkspaceId)
        .order("inserted_at", { ascending: false });

      if (prErr) throw prErr;

      const allProjects = ((pr as any) ?? []) as ProjectRow[];

      // ✅ Hide proposed + archived
      const visibleProjects = allProjects.filter((p) => p.status !== "proposed" && p.status !== "archived");
      const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));

      const projectById = new Map<string, ProjectRow>();
      for (const p of visibleProjects) projectById.set(p.id, p);

      // If no visible projects -> empty gantt
      if (visibleProjects.length === 0) {
        setTasks([]);
        return;
      }

      // 2) Windows per project (based on Hours)
      const { data: pw, error: pwErr } = await supabase
        .from("time_entries_project_window")
        .select("project_id,start_date,end_date")
        .eq("workspace_id", pWorkspaceId)
        .eq("user_id", pUserId);

      if (pwErr) throw pwErr;

      let projectWindows = (((pw as any) ?? []) as ProjectWindowRow[]).filter((x) => x.project_id);

      // ✅ Filter out proposed/archived projects
      projectWindows = projectWindows.filter((w) => visibleProjectIds.has(w.project_id));

      if (projectWindows.length === 0) {
        setTasks([]);
        return;
      }

      // 3) Windows per todo (based on Hours)
      const { data: tw, error: twErr } = await supabase
        .from("time_entries_todo_window")
        .select("todo_id,project_id,start_date,end_date")
        .eq("workspace_id", pWorkspaceId)
        .eq("user_id", pUserId);

      if (twErr) throw twErr;

      let todoWindows = (((tw as any) ?? []) as TodoWindowRow[]).filter((x) => !!x.todo_id);

      // ✅ Filter out todos belonging to proposed/archived projects
      todoWindows = todoWindows.filter((w) => visibleProjectIds.has(w.project_id));

      // 4) Load todo titles for windowed todo_ids
      const todoIds = Array.from(new Set(todoWindows.map((t) => t.todo_id).filter(Boolean))) as string[];

      const todoById = new Map<string, TodoRow>();
      if (todoIds.length > 0) {
        const { data: td, error: tdErr } = await supabase.from("todos").select("id,title,project_id").in("id", todoIds);

        if (tdErr) throw tdErr;

        for (const t of ((td as any) ?? []) as TodoRow[]) {
          // extra safety: only keep if project is visible
          if (visibleProjectIds.has(t.project_id)) {
            todoById.set(t.id, t);
          }
        }
      }

      // 5) Build todo tasks grouped by project
      const tasksByProject = new Map<string, { todoId: string; title: string; start: string; end: string }[]>();

      for (const w of todoWindows) {
        if (!w.todo_id) continue;

        const todo = todoById.get(w.todo_id);
        if (!todo) continue;

        // safety (should already be true)
        if (!visibleProjectIds.has(todo.project_id)) continue;

        const list = tasksByProject.get(todo.project_id) ?? [];
        list.push({
          todoId: todo.id,
          title: todo.title,
          start: w.start_date,
          end: w.end_date,
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

      for (const pwRow of projOrder) {
        const pid = pwRow.project_id;
        const projName = projectById.get(pid)?.name ?? "Project";

        if (!pwRow.start_date || !pwRow.end_date) continue;

        const pStartDate = isoToUtcDate(pwRow.start_date);
        const pEndDate = addOneDay(isoToUtcDate(pwRow.end_date)); // +1 once here

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

          // Measure after layout. We do it twice to be safe (Frappe updates DOM in steps).
          const el = ganttRef.current!;
          const applyMeasure = () => {
            const h = measureSvgHeight(el);
            if (h) {
              setMeasuredHeight((prev) => {
                // avoid tiny oscillations that can cause rerenders
                return Math.abs(prev - h) > 8 ? h : prev;
              });
            }
          };

          setTimeout(applyMeasure, 0);
          setTimeout(applyMeasure, 50);

          // ✅ Center “today” in the middle of the viewport
          setTimeout(centerTodayInView, 0);
          setTimeout(centerTodayInView, 60);
          setTimeout(centerTodayInView, 180);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // Keep today centered when resizing (optional but nice)
  useEffect(() => {
    const onResize = () => centerTodayInView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {!isAdmin ? <div className="text-xs text-gray-500">You can only view your own planning.</div> : null}
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
            <div className="text-xs text-gray-400">
              Hidden here: <span className="font-medium">proposed</span> and <span className="font-medium">archived</span>{" "}
              projects.
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      <section className="mt-6 border rounded-lg bg-white">
        <div ref={scrollRef} className="overflow-x-auto">
          <div ref={ganttRef} className="gantt-container min-w-[900px] p-2 pl-4" style={{ height: ganttHeight }} />
        </div>
      </section>

      <div className="mt-3 text-xs text-gray-500">Note: Simplified MVP (no progress). Uses database aggregation for speed.</div>
    </main>
  );
}
