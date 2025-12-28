"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { statusBadgeClass, priorityBadgeClass, metaBadgeClass, badgeBase } from "@/app/lib/badges";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type Priority = "low" | "medium" | "high" | "very_high";
type ViewMode = "projects" | "todos" | "both";
type SortMode = "priority_desc" | "newest";

// ✅ Nieuwe task statuses (MVP)
type TaskStatus = "todo" | "doing" | "blocked" | "done";

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

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus; // ✅ nieuw
  is_done: boolean; // blijft bestaan (compat)
  assigned_to: string | null;
  estimated_minutes: number | null;
  inserted_at: string;
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
  return `${h}u`;
}

function pct(executed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((executed / planned) * 100));
}

function priorityRank(p: Priority | null | undefined) {
  switch (p) {
    case "very_high":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 2;
  }
}

// ✅ Task badge mapping (zelfde stijl als projects)
function badgeClassForTaskStatus(status: TaskStatus) {
  switch (status) {
    case "todo":
      return "bg-gray-100 text-gray-700";
    case "doing":
      return "bg-blue-100 text-blue-800";
    case "blocked":
      return "bg-red-100 text-red-800";
    case "done":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
function taskStatusBadgeClass(status: TaskStatus) {
  return `${badgeBase} ${badgeClassForTaskStatus(status)}`;
}

export default function ProjectsKanbanPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRef = useRef<ProjectRow[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const [todos, setTodos] = useState<TodoRow[]>([]);

  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "none" | string>("all");

  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag & drop state (project cards)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  // voorkomt race conditions
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
          setWorkspaceId(null);
          setRole("member");
          setProjects([]);
          setTodos([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setOwners([]);
          setLoadError("Geen workspace gevonden.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // 1) Projects
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select(
          "id,workspace_id,name,description,status,priority,project_type,deadline,owner_id,created_by,inserted_at"
        )
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (prErr) {
        console.error(prErr);
        setProjects([]);
        setTodos([]);
        setLoadError(prErr.message);
        setLoading(false);
        return;
      }

      const list = (pr as any as ProjectRow[]) ?? [];
      setProjects(list);

      // 2) Owners
      const { data: mem, error: memErr } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(full_name,email)")
        .eq("workspace_id", ws.workspaceId)
        .order("created_at", { ascending: true });

      if (memErr) {
        console.warn("Load owners failed:", memErr);
        setOwners([]);
      } else {
        const opts: OwnerOption[] = ((mem as any[]) ?? []).map((m) => {
          const id = m.user_id as string;
          const full = m.profiles?.full_name as string | null | undefined;
          const email = m.profiles?.email as string | null | undefined;
          const label = (full && full.trim()) || email || id.slice(0, 8);
          return { id, label };
        });
        setOwners(opts);
      }

      // 3) Totals
      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
        setTodos([]);
        setLoading(false);
        return;
      }

      const [{ data: plan, error: planErr }, { data: exec, error: execErr }] = await Promise.all([
        supabase.from("project_planned_totals").select("project_id, planned_minutes").in("project_id", ids),
        supabase.from("project_executed_totals").select("project_id, executed_minutes").in("project_id", ids),
      ]);

      if (seq !== loadSeq.current) return;

      if (planErr) console.warn("planned totals error:", planErr);
      if (execErr) console.warn("executed totals error:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of (plan as any as TotalsRowPlanned[]) ?? []) {
        planMap[r.project_id] = r.planned_minutes ?? 0;
      }
      setPlannedByProject(planMap);

      const execMap: Record<string, number> = {};
      for (const r of (exec as any as TotalsRowExecuted[]) ?? []) {
        execMap[r.project_id] = r.executed_minutes ?? 0;
      }
      setExecutedByProject(execMap);

      // 4) Todos: geen workspace_id, dus via project_id IN ids
      // We tonen in kanban standaard geen "done" taken
      const { data: td, error: tdErr } = await supabase
        .from("todos")
        .select("id,project_id,title,status,is_done,assigned_to,estimated_minutes,inserted_at")
        .in("project_id", ids)
        .neq("status", "done")
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (tdErr) {
        console.warn("Load todos failed:", tdErr);
        setTodos([]);
      } else {
        setTodos(((td as any) ?? []) as TodoRow[]);
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
      setLoadError(e?.message ?? "Fout bij laden.");
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

  // ---- Filtering + sorting (projects) ----
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

  const filteredProjectIds = useMemo(() => new Set(sortedFilteredProjects.map((p) => p.id)), [sortedFilteredProjects]);

  // Todos volgen projectfilters (owner/prio) — MVP
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => filteredProjectIds.has(t.project_id));
  }, [todos, filteredProjectIds]);

  const todosByProject = useMemo(() => {
    const m: Record<string, TodoRow[]> = {};
    for (const t of filteredTodos) {
      if (!m[t.project_id]) m[t.project_id] = [];
      m[t.project_id].push(t);
    }
    // Sort tasks: blocked -> doing -> todo (zodat "problemen" bovenaan staan), daarna newest
    const rank: Record<TaskStatus, number> = { blocked: 3, doing: 2, todo: 1, done: 0 };
    for (const pid of Object.keys(m)) {
      m[pid].sort((a, b) => {
        const d = (rank[b.status] ?? 0) - (rank[a.status] ?? 0);
        if (d !== 0) return d;
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    }
    return m;
  }, [filteredTodos]);

  const byStatus = useMemo(() => {
    const m: Record<ProjectStatus, ProjectRow[]> = { proposed: [], active: [], done: [], archived: [] };
    for (const p of sortedFilteredProjects) m[p.status].push(p);
    return m;
  }, [sortedFilteredProjects]);

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  // ---- Updates ----
  async function updateProjectStatus(projectId: string, nextStatus: ProjectStatus) {
    const prev = projectsRef.current;

    // Optimistic UI
    setProjects((cur) => cur.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)));

    const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);

    if (error) {
      console.error(error);
      alert(error.message);
      setProjects(prev); // rollback
    }
  }

  async function updateTodoStatus(todoId: string, nextStatus: TaskStatus) {
    // Optimistic UI (in-place)
    const prev = todos;
    setTodos((cur) => cur.map((t) => (t.id === todoId ? { ...t, status: nextStatus, is_done: nextStatus === "done" } : t)));

    const { error } = await supabase
      .from("todos")
      .update({ status: nextStatus, is_done: nextStatus === "done" })
      .eq("id", todoId);

    if (error) {
      console.error(error);
      alert(error.message);
      setTodos(prev); // rollback
    }
  }

  // ---- UI components ----
  function ProjectCard({ p, compact }: { p: ProjectRow; compact?: boolean }) {
    const planned = plannedByProject[p.id] ?? 0;
    const executed = executedByProject[p.id] ?? 0;
    const percent = pct(executed, planned);

    const ownerLabel = p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

    return (
      <div
        draggable
        style={{ cursor: "grab" }}
        onDragStart={(e) => {
          // ✅ IMPORTANT: setData first, then state update next frame (fixes “can’t drag”)
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          requestAnimationFrame(() => setDraggingId(p.id));
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverStatus(null);
        }}
        className={[
          "rounded-lg border bg-white p-3 shadow-sm hover:shadow transition-shadow",
          "w-full max-w-full overflow-hidden",
          draggingId === p.id ? "opacity-60 ring-2 ring-blue-400" : "",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            {!compact && p.description ? (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
            ) : null}
          </div>

          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => router.push(`/projects/${p.id}`)}
          >
            Open
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className={statusBadgeClass(p.status)}>{p.status}</span>
          <span className={priorityBadgeClass(p.priority)}>prio: {p.priority ?? "medium"}</span>
          {p.project_type ? <span className={metaBadgeClass()}>type: {p.project_type}</span> : null}
          {p.deadline ? <span className={metaBadgeClass()}>deadline: {p.deadline}</span> : null}
          <span className={metaBadgeClass()}>owner: {ownerLabel}</span>
        </div>

        {/* Mobile fallback for project status */}
        <div className="mt-2 md:hidden">
          <label className="text-[11px] text-gray-500">Project status</label>
          <select
            className="mt-1 w-full border rounded-md px-2 py-1 text-sm"
            value={p.status}
            onChange={(e) => updateProjectStatus(p.id, e.target.value as ProjectStatus)}
          >
            {STATUS_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {!compact ? (
          <div className="mt-3">
            {planned > 0 ? (
              <ProgressBar
                value={percent}
                label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`}
              />
            ) : (
              <div className="text-sm text-gray-500">Geen raming (planned = 0)</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function TodoCard({ t, projectId }: { t: TodoRow; projectId: string }) {
    return (
      <div className="rounded-md border bg-white px-3 py-2 w-full max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{t.title}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className={taskStatusBadgeClass(t.status)}>{t.status}</span>
              {t.estimated_minutes ? (
                <span className={metaBadgeClass()}>raming: {minutesToHoursText(t.estimated_minutes)}</span>
              ) : (
                <span className={metaBadgeClass()}>geen raming</span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="text-xs px-2 py-1 shrink-0"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            Open
          </Button>
        </div>

        <div className="mt-2">
          <label className="text-[11px] text-gray-500">Taak status</label>
          <select
            className="mt-1 w-full border rounded-md px-2 py-1 text-xs"
            value={t.status}
            onChange={(e) => updateTodoStatus(t.id, e.target.value as TaskStatus)}
          >
            <option value="todo">todo</option>
            <option value="doing">doing</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
          </select>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projecten • Kanban</h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Rol: {role}</div>

          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Lijst
          </Button>
          <Button onClick={() => router.push("/projects/new")}>
            {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="mt-5 border rounded-lg p-4">
        <div className="font-medium">Filters</div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs text-gray-500">Prioriteit</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
            >
              <option value="all">Alle</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Owner</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="all">Alle</option>
              <option value="none">— geen owner —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Weergave</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="projects">Projecten</option>
              <option value="todos">Taken</option>
              <option value="both">Beide</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Sortering</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Prioriteit (hoog → laag)</option>
              <option value="newest">Nieuwste eerst</option>
            </select>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}

        <div className="mt-3 text-xs text-gray-500">
          Drag & drop wijzigt <span className="font-medium">projectstatus</span>. Taken hebben nu een eigen status via dropdown.
        </div>
      </section>

      {/* Kanban */}
      <section className="mt-6">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1080px] grid grid-cols-[repeat(4,260px)] gap-4">
            {STATUS_COLUMNS.map((col) => (
              <div
                key={col.key}
                className={[
                  "rounded-lg border bg-gray-50 transition-colors",
                  dragOverStatus === col.key ? "ring-2 ring-blue-400 bg-blue-50/30" : "",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStatus(col.key);
                }}
                onDragLeave={() => {
                  setDragOverStatus((s) => (s === col.key ? null : s));
                }}
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
                  <div className="text-xs text-gray-500">{byStatus[col.key].length}</div>
                </div>

                <div className="p-3 grid gap-3">
                  {byStatus[col.key].length === 0 ? (
                    <div className="text-sm text-gray-500">Geen projecten</div>
                  ) : (
                    byStatus[col.key].map((p) => {
                      const projectTodos = todosByProject[p.id] ?? [];
                      const showProject = viewMode === "projects" || viewMode === "both";
                      const showTodos = viewMode === "todos" || viewMode === "both";

                      return (
                        <div key={p.id} className="grid gap-2">
                          {/* Project card (of compact header in todos-only) */}
                          {showProject ? <ProjectCard p={p} compact={false} /> : <ProjectCard p={p} compact={true} />}

                          {/* Todos */}
                          {showTodos ? (
                            projectTodos.length === 0 ? null : (
                              <div className="grid gap-2">
                                {projectTodos.map((t) => (
                                  <TodoCard key={t.id} t={t} projectId={p.id} />
                                ))}
                              </div>
                            )
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Sortering “prioriteit” bepaalt de volgorde van projecten (en dus ook van hun taken).
        </div>
      </section>
    </main>
  );
}
