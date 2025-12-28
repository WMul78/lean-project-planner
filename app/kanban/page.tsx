"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type Priority = "low" | "medium" | "high" | "very_high";

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

export default function ProjectsKanbanPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRef = useRef<ProjectRow[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "none" | string>("all");

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
        setLoadError(prErr.message);
        setLoading(false);
        return;
      }

      const list = (pr as any as ProjectRow[]) ?? [];
      setProjects(list);

      // 2) Owner options (workspace members + profiles)
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

      // 3) Totals (planned/executed) via views
      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
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

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Kanban load failed:", e);
      setProjects([]);
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

  const byStatus = useMemo(() => {
    const m: Record<ProjectStatus, ProjectRow[]> = {
      proposed: [],
      active: [],
      done: [],
      archived: [],
    };
    for (const p of filteredProjects) m[p.status].push(p);
    return m;
  }, [filteredProjects]);

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

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
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
                      const planned = plannedByProject[p.id] ?? 0;
                      const executed = executedByProject[p.id] ?? 0;
                      const percent = pct(executed, planned);

                      const ownerLabel =
                        p.owner_id === null
                          ? "—"
                          : owners.find((o) => o.id === p.owner_id)?.label ?? p.owner_id.slice(0, 8);

                      return (
                        <div
                          key={p.id}
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
                              {p.description ? (
                                <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {p.description}
                                </div>
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
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              prio: {p.priority ?? "medium"}
                            </span>
                            {p.project_type ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                type: {p.project_type}
                              </span>
                            ) : null}
                            {p.deadline ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                deadline: {p.deadline}
                              </span>
                            ) : null}
                          </div>

                          {/* Mobile fallback: status dropdown (iOS DnD is inconsistent) */}
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

                          <div className="mt-3">
                            {planned > 0 ? (
                              <>
                                <ProgressBar
                                  value={percent}
                                  label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`}
                                />
                                <div className="mt-1 text-[11px] text-gray-500">owner: {ownerLabel}</div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Geen raming (planned = 0)
                                <div className="text-[11px] text-gray-400 mt-1">owner: {ownerLabel}</div>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 text-[11px] text-gray-400 hidden md:block">
                            Sleep deze kaart naar een andere kolom om de status te wijzigen.
                          </div>
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
          Drag & drop wijzigt de project status. Op mobiel kun je ook via het status dropdown menu wisselen.
        </div>
      </section>
    </main>
  );
}
