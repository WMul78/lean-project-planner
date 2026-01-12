"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";
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

const [tier, setTier] = useState<"free" | "core" | "pro">("free");

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

export default function ProjectsKanbanPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRef = useRef<ProjectRow[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const [todos, setTodos] = useState<TodoAutoRow[]>([]);

  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Filters (keep original behavior)
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "none" | string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag & drop (projects only) — keep original stable implementation
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  const loadSeq = useRef(0);

  // Only paid workspaces (core/pro) may change project status in Kanban.
  // Stakeholders are always read-only.
  const canMoveProjects = role !== "stakeholder" && tier !== "free";

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
          setLoadError("No workspace found.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      // Load effective tier (free/core/pro)
      const t = await getActiveWorkspaceTier();
      setTier(t);
    }


      // 1) Projects
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,workspace_id,name,description,status,priority,project_type,deadline,owner_id,created_by,inserted_at")
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

      const projectList = ((pr as any) ?? []) as ProjectRow[];
      setProjects(projectList);

      // 2) Owners (workspace_members + profiles)
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

      if (planErr) console.warn("planned totals error:", planErr);
      if (execErr) console.warn("executed totals error:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of (((plan as any) ?? []) as TotalsRowPlanned[])) planMap[r.project_id] = r.planned_minutes ?? 0;
      setPlannedByProject(planMap);

      const execMap: Record<string, number> = {};
      for (const r of (((exec as any) ?? []) as TotalsRowExecuted[])) execMap[r.project_id] = r.executed_minutes ?? 0;
      setExecutedByProject(execMap);

      // 4) Todos via view todo_status_auto (no workspace_id -> filter by project_id)
      // MVP: do not show "done" tasks in Kanban
      const { data: td, error: tdErr } = await supabase
        .from("todo_status_auto")
        .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,is_done,executed_minutes,auto_status")
        .in("project_id", ids)
       // .neq("auto_status", "done")
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
      setLoadError(e?.message ?? "Failed to load.");
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

  // ---- Filters / sorting projects ----
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

  // ---- Tasks follow project filters (owner/priority), but get their own column status ----
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

    // Sort tasks by project priority (high -> low), then by newest
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
  // Hard block: no status changes in Kanban on free workspaces or for stakeholders
  if (tier === "free" || role === "stakeholder") {
    alert("Changing project status in Kanban is available on the paid plan. Upgrade to enable this feature.");
    router.push("/settings/billing");
    return;
  }

  const prev = projectsRef.current;
  setProjects((cur) => cur.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)));

  const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);
  if (error) {
    console.error(error);
    alert(error.message);
    setProjects(prev);
  }
}


  function ProjectCard({ p, compact }: { p: ProjectRow; compact?: boolean }) {
    const planned = plannedByProject[p.id] ?? 0;
    const executed = executedByProject[p.id] ?? 0;
    const percent = pct(executed, planned);
    const ownerLabel = p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

    return (
      <div
        draggable={canMoveProjects}
        style={{ cursor: canMoveProjects ? "grab" : "default" }}
        onDragStart={(e) => {
          if (!canMoveProjects) return;
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          requestAnimationFrame(() => setDraggingId(p.id));
        }}
        onDragEnd={() => {
          if (!canMoveProjects) return;
          setDraggingId(null);
          setDragOverStatus(null);
         }}
        className={[
          "rounded-lg border bg-white p-3 shadow-sm hover:shadow transition-shadow",
          "w-full max-w-full overflow-hidden",
          draggingId === p.id ? "opacity-60 ring-2 ring-blue-400" : "",
          !canMoveProjects ? "select-text" : "",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            {!compact && p.description ? (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
            ) : null}
          </div>

          <Button variant="outline" className="shrink-0" onClick={() => router.push(`/projects/${p.id}`)}>
            Open
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className={statusBadgeClass(p.status)}>{p.status}</span>
          <span className={priorityBadgeClass(p.priority)}>priority: {p.priority ?? "medium"}</span>
          {p.project_type ? <span className={metaBadgeClass()}>type: {p.project_type}</span> : null}
          {p.deadline ? <span className={metaBadgeClass()}>deadline: {p.deadline}</span> : null}
          <span className={metaBadgeClass()}>owner: {ownerLabel}</span>
        </div>

        <div className="mt-2 md:hidden">
          <label className="text-[11px] text-gray-500">Project status</label>
          <select
  className="mt-1 w-full border rounded-md px-2 py-1 text-sm"
  value={p.status}
  disabled={!canMoveProjects}
  onChange={(e) => updateProjectStatus(p.id, e.target.value as ProjectStatus)}
>
  {STATUS_COLUMNS.map((c) => (
    <option key={c.key} value={c.key}>
      {c.label}
    </option>
  ))}
</select>

{!canMoveProjects ? (
  <div className="mt-1 text-[11px] text-amber-700">
    Status changes in Kanban require a paid plan.
  </div>
) : null}

        </div>

        {!compact ? (
          <div className="mt-3">
            {planned > 0 ? (
              <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
            ) : (
              <div className="text-sm text-gray-500">No estimate (planned = 0)</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function TodoCard({ t }: { t: TodoAutoRow }) {
    const p = projectById[t.project_id];
    const projectName = p?.name ?? "Project";
    const prio = p?.priority ?? "medium";
    const planned = t.estimated_minutes ?? 0;
    const executed = t.executed_minutes ?? 0;
    const percent = planned > 0 ? pct(executed, planned) : 0;

    return (
      <div className="rounded-md border bg-white px-3 py-2 w-full max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{t.title}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className={metaBadgeClass()}>project: {projectName}</span>
              <span className={priorityBadgeClass(prio)}>priority: {prio}</span>
              {planned > 0 ? (
                <span className={metaBadgeClass()}>
                  {minutesToHoursText(executed)} / {minutesToHoursText(planned)} ({percent}%)
                </span>
              ) : (
                <span className={metaBadgeClass()}>no estimate</span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="text-xs px-2 py-1 shrink-0"
            onClick={() => router.push(`/projects/${t.project_id}`)}
          >
            Open
          </Button>
        </div>

        {planned > 0 ? (
          <div className="mt-2">
            <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
          </div>
        ) : null}

        <div className="mt-2 text-[11px] text-gray-500">
          Status is automatic based on progress: 0% proposed, 1–99% active, 100% done.
        </div>
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-semibold">Projects • Kanban</h1>
          

          <div className="text-sm text-gray-500">Role: {role}</div>

          {/* Workspace ID intentionally not shown */}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Priority</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
            >
              <option value="all">All</option>
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
              <option value="all">All</option>
              <option value="none">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">View</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="projects">Projects</option>
              <option value="todos">Tasks</option>
              <option value="both">Projects + tasks</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Sort</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Priority (high → low)</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      <section className="mt-6">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1080px] grid grid-cols-[repeat(4,260px)] gap-4">
            {STATUS_COLUMNS.map((col) => (
              <div
              key={col.key}
              className={[
                "rounded-lg border bg-gray-50 transition-colors",
                canMoveProjects && dragOverStatus === col.key
                  ? "ring-2 ring-blue-400 bg-blue-50/30"
                  : "",
              ].join(" ")}
              onDragOver={(e) => {
              if (!canMoveProjects) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(col.key);
              }}
              onDragLeave={() => {
                if (!canMoveProjects) return;
                setDragOverStatus((s) => (s === col.key ? null : s));
              }}
              onDrop={async (e) => {
                if (!canMoveProjects) return;
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
          Task status is automatically determined based on progress (hours logged up to today).
        </div>
      </section>
    </main>
  );
}
