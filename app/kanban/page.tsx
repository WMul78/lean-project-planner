"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { statusBadgeClass, priorityBadgeClass, metaBadgeClass } from "@/app/lib/badges";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type Priority = "low" | "medium" | "high" | "very_high";
type ViewMode = "projects" | "todos" | "both";
type SortMode = "priority_desc" | "newest";

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority | null;
  project_type: string | null;
  deadline: string | null;
  owner_id: string | null;
  created_by: string;
  inserted_at: string;
};

type TodoAutoRow = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  is_done: boolean;
  executed_minutes: number;
  auto_status: "proposed" | "active" | "done"; // from view
};

type TotalsRowPlanned = { project_id: string; planned_minutes: number };
type TotalsRowExecuted = { project_id: string; executed_minutes: number };

type OwnerOption = { id: string; label: string };

const STATUS_COLUMNS: { key: ProjectStatus; label: string }[] = [
  { key: "proposed", label: "Proposed" },
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}h`;
}

function priorityRank(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return 4;
  if (v === "high") return 3;
  if (v === "medium") return 2;
  return 1;
}

function clampPct(x: number) {
  return Math.min(100, Math.max(0, x));
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return clampPct(Math.round((executed / planned) * 100));
}

export default function KanbanPage() {
  const router = useRouter();

  const [role, setRole] = useState<WorkspaceRole>("member");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRef = useRef<ProjectRow[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const [todos, setTodos] = useState<TodoAutoRow[]>([]);
  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Filters (keep behavior as-is)
  const [filterPriority, setFilterPriority] = useState<string>("all"); // all | low | medium | high | very_high
  const [filterOwner, setFilterOwner] = useState<string>("all"); // all | none | userId
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  // Drag & drop UI state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);

    const user = await requireUser(router);
    if (!user) {
      if (seq === loadSeq.current) setLoading(false);
      return;
    }

    try {
      const ws = await getActiveWorkspace();

      if (!ws?.workspaceId) {
        if (seq === loadSeq.current) {
          setRole("member");
          setProjects([]);
          setTodos([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setOwners([]);
          setLoadError("No active workspace found for this user.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setRole(ws.role);
      }

      // 1) Owners (workspace members) for filter dropdown
      const { data: members, error: memErr } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(full_name,email)")
        .eq("workspace_id", ws.workspaceId)
        .order("created_at", { ascending: true });

      if (seq !== loadSeq.current) return;

      if (memErr) {
        console.warn("Load workspace members failed:", memErr);
        setOwners([]);
      } else {
        const opts: OwnerOption[] = ((members as any[]) ?? []).map((m) => {
          const id = m.user_id as string;
          const full = m.profiles?.full_name as string | null | undefined;
          const email = m.profiles?.email as string | null | undefined;
          const label = (full && full.trim()) || email || id.slice(0, 8);
          return { id, label };
        });
        setOwners(opts);
      }

      // 2) Projects
      const { data: pData, error: pErr } = await supabase
        .from("projects")
        .select("id,workspace_id,name,description,status,priority,project_type,deadline,owner_id,created_by,inserted_at")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (pErr) {
        console.warn("Load projects failed:", pErr);
        setProjects([]);
        setTodos([]);
        setPlannedByProject({});
        setExecutedByProject({});
        setLoadError(pErr.message);
        setLoading(false);
        return;
      }

      const projectList = ((pData as any) ?? []) as ProjectRow[];
      setProjects(projectList);

      const ids = projectList.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
        setTodos([]);
        setLoading(false);
        return;
      }

      // 3) Totals via views
      const [{ data: plan, error: planErr }, { data: exec, error: execErr }] = await Promise.all([
        supabase.from("project_planned_totals").select("project_id, planned_minutes").in("project_id", ids),
        supabase.from("project_executed_totals").select("project_id, executed_minutes").in("project_id", ids),
      ]);

      if (seq !== loadSeq.current) return;

      if (planErr) console.warn("Planned totals load failed:", planErr);
      if (execErr) console.warn("Executed totals load failed:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of ((plan as any) ?? []) as TotalsRowPlanned[]) planMap[r.project_id] = r.planned_minutes ?? 0;
      setPlannedByProject(planMap);

      const execMap: Record<string, number> = {};
      for (const r of ((exec as any) ?? []) as TotalsRowExecuted[]) execMap[r.project_id] = r.executed_minutes ?? 0;
      setExecutedByProject(execMap);

      // 4) Todos via view todo_status_auto (no workspace_id -> filter by project_id)
      // MVP: we do not show done tasks in Kanban
      const { data: td, error: tdErr } = await supabase
        .from("todo_status_auto")
        .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,is_done,executed_minutes,auto_status")
        .in("project_id", ids)
        .neq("auto_status", "done")
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (tdErr) {
        console.warn("Load todos failed:", tdErr);
        setTodos([]);
      } else {
        setTodos(((td as any) ?? []) as TodoAutoRow[]);
      }

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Kanban load failed:", e);
      setProjects([]);
      setTodos([]);
      setPlannedByProject({});
      setExecutedByProject({});
      setOwners([]);
      setLoadError(e?.message ?? "Failed to load Kanban data.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [load]);

  // ---- Filters / sorting projects (keep behavior as-is) ----
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const prioOk = filterPriority === "all" ? true : (p.priority ?? "medium") === filterPriority;

      const ownerOk =
        filterOwner === "all"
          ? true
          : filterOwner === "none"
            ? p.owner_id === null
            : p.owner_id === filterOwner;

      return prioOk && ownerOk;
    });
  }, [projects, filterPriority, filterOwner]);

  const sortedFilteredProjects = useMemo(() => {
    const arr = [...filteredProjects];
    if (sortMode === "priority_desc") {
      arr.sort((a, b) => {
        const d = priorityRank(b.priority) - priorityRank(a.priority);
        if (d !== 0) return d;
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    } else {
      arr.sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    }
    return arr;
  }, [filteredProjects, sortMode]);

  const projectById = useMemo(() => {
    const m: Record<string, ProjectRow> = {};
    for (const p of projects) m[p.id] = p;
    return m;
  }, [projects]);

  const filteredProjectIds = useMemo(() => new Set(sortedFilteredProjects.map((p) => p.id)), [sortedFilteredProjects]);

  // Tasks follow project filters (owner/priority), but have their own Kanban column status.
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => filteredProjectIds.has(t.project_id));
  }, [todos, filteredProjectIds]);

  // Task -> Kanban column status:
  // - if project is archived => task appears in archived column
  // - else use auto_status (proposed/active/done)
  const todoColumnStatus = useCallback(
    (t: TodoAutoRow): ProjectStatus => {
      const p = projectById[t.project_id];
      if (p?.status === "archived") return "archived";
      return t.auto_status; // proposed | active | done
    },
    [projectById]
  );

  const todosByColumn = useMemo(() => {
    const m: Record<ProjectStatus, TodoAutoRow[]> = { proposed: [], active: [], done: [], archived: [] };
    for (const t of filteredTodos) {
      m[todoColumnStatus(t)].push(t);
    }

    // Sort tasks by project priority (high -> low), then newest
    for (const k of Object.keys(m) as ProjectStatus[]) {
      m[k].sort((a, b) => {
        const pa = projectById[a.project_id]?.priority;
        const pb = projectById[b.project_id]?.priority;
        const d = priorityRank(pb) - priorityRank(pa);
        if (d !== 0) return d;
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    }

    return m;
  }, [filteredTodos, projectById, todoColumnStatus]);

  const projectsByColumn = useMemo(() => {
    const m: Record<ProjectStatus, ProjectRow[]> = { proposed: [], active: [], done: [], archived: [] };
    for (const p of sortedFilteredProjects) m[p.status].push(p);
    return m;
  }, [sortedFilteredProjects]);

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  async function updateProjectStatus(projectId: string, nextStatus: ProjectStatus) {
    const prev = projectsRef.current;
    setProjects((cur) => cur.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)));

    const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);

    if (error) {
      // Revert optimistic update
      setProjects(prev);
      alert(error.message);
    }
  }

  function ProjectCard({ p, compact }: { p: ProjectRow; compact: boolean }) {
    const planned = plannedByProject[p.id] ?? 0;
    const executed = executedByProject[p.id] ?? 0;
    const pct = calcPct(executed, planned);

    const ownerLabel = p.owner_id ? ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8) : "—";

    return (
      <div
        className={[
          "border rounded-lg bg-white p-3 shadow-sm",
          draggingId === p.id ? "opacity-60" : "",
        ].join(" ")}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggingId(p.id);
        }}
        onDragEnd={() => setDraggingId(null)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>

            {compact ? null : p.description ? (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={statusBadgeClass(p.status)}>{p.status}</span>
              <span className={priorityBadgeClass(p.priority)}>{p.priority ?? "medium"}</span>
              {p.project_type ? <span className={metaBadgeClass()}>{p.project_type}</span> : null}
              <span className={metaBadgeClass()}>Owner: {ownerLabel}</span>
              {p.deadline ? <span className={metaBadgeClass()}>Deadline: {p.deadline}</span> : null}
            </div>

            <div className="mt-3">
              {/* Your working ProgressBar API */}
              <ProgressBar value={pct} />
              <div className="mt-1 text-xs text-gray-500">
                Planned: {minutesToHoursText(planned)} • Executed: {minutesToHoursText(executed)}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Button variant="outline" onClick={() => router.push(`/projects/${p.id}`)}>
              Open
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function TodoCard({ t }: { t: TodoAutoRow }) {
    const p = projectById[t.project_id];
    const ownerLabel = p?.owner_id ? ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8) : "—";

    return (
      <div className="border rounded-lg bg-white p-3 shadow-sm">
        <div className="text-sm font-medium">{t.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {p ? (
            <>
              <span className={metaBadgeClass()}>Project: {p.name}</span>
              <span className={priorityBadgeClass(p.priority)}>{p.priority ?? "medium"}</span>
              <span className={metaBadgeClass()}>Owner: {ownerLabel}</span>
            </>
          ) : (
            <span className={metaBadgeClass()}>Project: unknown</span>
          )}
          {t.estimated_minutes ? (
            <span className={metaBadgeClass()}>Estimate: {minutesToHoursText(t.estimated_minutes)}</span>
          ) : null}
          {typeof t.executed_minutes === "number" ? (
            <span className={metaBadgeClass()}>Logged: {minutesToHoursText(t.executed_minutes)}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kanban</h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>

          {/* Workspace ID removed on purpose */}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/projects")}>Projects</Button>
        </div>
      </header>

      <section className="mt-6 border rounded-lg p-4 bg-white">
        {/* Filters (keep the same set of filters) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Priority</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Owner</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Sort</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Priority (high → low)</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">View</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="both">Projects + tasks</option>
              <option value="projects">Projects only</option>
              <option value="todos">Tasks only</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="mt-8 text-gray-500">Loading…</div>
      ) : loadError ? (
        <div className="mt-8 text-gray-600">
          <div className="font-medium text-red-700">Could not load Kanban</div>
          <div className="mt-2 text-sm text-gray-600">{loadError}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <section className="mt-6">
          <div className="overflow-x-auto">
            <div className="min-w-[1050px] grid grid-cols-4 gap-4">
              {STATUS_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className={[
                    "border rounded-lg bg-gray-50",
                    dragOverStatus === col.key ? "ring-2 ring-blue-400 bg-blue-50/30" : "",
                  ].join(" ")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverStatus(col.key);
                  }}
                  onDragLeave={() => setDragOverStatus((s) => (s === col.key ? null : s))}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const pid = e.dataTransfer.getData("text/plain");
                    setDragOverStatus(null);
                    setDraggingId(null);

                    if (!pid) return;

                    const p = projectsRef.current.find((x) => x.id === pid);
                    if (!p) return;
                    if (p.status === col.key) return;

                    await updateProjectStatus(pid, col.key);
                  }}
                >
                  <div className="px-3 py-2 border-b bg-white rounded-t-lg flex items-center justify-between">
                    <div className="font-semibold">{col.label}</div>
                    <div className="text-xs text-gray-500">
                      {projectsByColumn[col.key].length} proj • {todosByColumn[col.key].length} tasks
                    </div>
                  </div>

                  <div className="p-3 grid gap-3">
                    {/* Projects */}
                    {viewMode === "projects" || viewMode === "both" ? (
                      projectsByColumn[col.key].length === 0 ? (
                        <div className="text-sm text-gray-500">No projects</div>
                      ) : (
                        projectsByColumn[col.key].map((p) => <ProjectCard key={p.id} p={p} compact={false} />)
                      )
                    ) : null}

                    {/* Tasks */}
                    {viewMode === "todos" || viewMode === "both" ? (
                      todosByColumn[col.key].length === 0 ? (
                        <div className="text-sm text-gray-500">No tasks</div>
                      ) : (
                        todosByColumn[col.key].map((t) => <TodoCard key={t.id} t={t} />)
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Task status is automatically derived from progress (hours logged up to today).
          </div>
        </section>
      )}
    </main>
  );
}
