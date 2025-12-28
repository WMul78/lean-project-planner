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

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  is_done: boolean;
  assigned_to: string | null;
  estimated_minutes: number | null;
  inserted_at: string;
};

type TotalsRowPlanned = { project_id: string; planned_minutes: number };
type TotalsRowExecuted = { project_id: string; executed_minutes: number };

type OwnerOption = {
  id: string; // user_id
  label: string;
};

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

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  // voorkomt race conditions: alleen laatste load mag state zetten
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

      // 3) Totals via views
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

      // 4) Todos (geen workspace_id, dus via project_id IN ids)
      const { data: td, error: tdErr } = await supabase
        .from("todos")
        .select("id,project_id,title,is_done,assigned_to,estimated_minutes,inserted_at")
        .in("project_id", ids)
        .eq("is_done", false)
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

  // reload wanneer workspace switcher verandert
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [load]);

  // ---- Filtering + sorting ----
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
        // fallback: nieuwste eerst
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    } else {
      arr.sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    }
    return arr;
  }, [filteredProjects, sortMode]);

  const filteredProjectIds = useMemo(() => new Set(sortedFilteredProjects.map((p) => p.id)), [sortedFilteredProjects]);

  const filteredTodos = useMemo(() => {
    // taken volgen projectfilter (owner/prio) — logisch: filter op owner = project owner
    return todos.filter((t) => filteredProjectIds.has(t.project_id));
  }, [todos, filteredProjectIds]);

  const todosByProject = useMemo(() => {
    const m: Record<string, TodoRow[]> = {};
    for (const t of filteredTodos) {
      if (!m[t.project_id]) m[t.project_id] = [];
      m[t.project_id].push(t);
    }
    // sort taken: newest eerst (of titel als je dat liever hebt)
    for (const pid of Object.keys(m)) {
      m[pid].sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    }
    return m;
  }, [filteredTodos]);

  const byStatus = useMemo(() => {
    const m: Record<ProjectStatus, ProjectRow[]> = {
      proposed: [],
      active: [],
      done: [],
      archived: [],
    };
    for (const p of sortedFilteredProjects) m[p.status].push(p);
    return m;
  }, [sortedFilteredProjects]);

  // ---- Status update (DnD + mobile dropdown) ----
  async function updateProjectStatus(projectId: string, nextStatus: ProjectStatus) {
    const prev = projectsRef.current;

    // Optimistic UI
    setProjects((cur) => cur.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)));

    const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);

    if (error) {
      console.error(error);
      alert(error.message);
      // rollback
      setProjects(prev);
    }
  }

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  // ---- UI helpers ----
  function ProjectCard({
    p,
    compact,
  }: {
    p: ProjectRow;
    compact?: boolean;
  }) {
    const planned = plannedByProject[p.id] ?? 0;
    const executed = executedByProject[p.id] ?? 0;
    const percent = pct(executed, planned);

    const ownerLabel =
      p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

    return (
      <div
        draggable
        style={{ cursor: "grab" }}
        onDragStart={(e) => {
          setDraggingId(p.id);
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
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
          <span className={priorityBadgeClass(p.priority)}>
            prio: {p.priority ?? "medium"}
          </span>
          {p.project_type ? <span className={metaBadgeClass()}>type: {p.project_type}</span> : null}
          {p.deadline ? <span className={metaBadgeClass()}>deadline: {p.deadline}</span> : null}
          <span className={metaBadgeClass()}>owner: {ownerLabel}</span>
        </div>

        {/* Mobile fallback (iOS DnD is inconsistent) */}
        <div className="mt-2 md:hidden">
          <label className="text-[11px] text-gray-500">Status</label>
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
        <div className="font-medium text-sm truncate">{t.title}</div>
        <div className="mt-1 text-[11px] text-gray-500">
          {t.estimated_minutes ? `raming: ${minutesToHoursText(t.estimated_minutes)}` : "geen raming"}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="text-xs px-2 py-1 shrink-0"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            Open project
          </Button>
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
          Drag & drop wijzigt projectstatus. Taken volgen altijd de status van hun project.
        </div>
      </section>

      {/* Kanban */}
      <section className="mt-6">
        <div className="overflow-x-auto pb-2">
          {/* Fixed column widths so cards never overflow columns */}
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
                          {/* Project card (of compacte header in todos-only) */}
                          {showProject ? (
                            <ProjectCard p={p} compact={false} />
                          ) : (
                            // todos-only: compact project header, zodat taken context hebben
                            <ProjectCard p={p} compact={true} />
                          )}

                          {/* Todos onder project */}
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
