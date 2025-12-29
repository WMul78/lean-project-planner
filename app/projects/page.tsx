"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { statusBadgeClass, priorityBadgeClass, metaBadgeClass } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectStatus = "proposed" | "active" | "done" | "archived";
type ProjectType = "standard" | "pdca" | "dmaic";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;
  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null;
  priority: Priority | null;
  project_type: ProjectType | null;
};

type TotalsRow = { project_id: string; planned_minutes?: number | null; executed_minutes?: number | null };

type OwnerOption = { id: string; label: string };

function priorityRank(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return 4;
  if (v === "high") return 3;
  if (v === "medium") return 2;
  return 1;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}h`;
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((executed / planned) * 100));
}

export default function ProjectsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<Project[]>([]);
  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Filters
  const [filterOwner, setFilterOwner] = useState<string>("all"); // all | none | userId
  const [filterStatus, setFilterStatus] = useState<string>("open"); // open | all | proposed | active | done | archived
  const [sortMode, setSortMode] = useState<"newest" | "priority_desc">("newest");

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
          setOwners([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setLoadError("No active workspace found for this user.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // 1) Load owners (workspace members) for the owner filter dropdown.
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

      // 2) Load projects
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .select("id,name,description,inserted_at,status,owner_id,created_by,deadline,priority,project_type")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (projErr) {
        setProjects([]);
        setPlannedByProject({});
        setExecutedByProject({});
        setLoadError(projErr.message);
        setLoading(false);
        return;
      }

      const list = ((proj as any) ?? []) as Project[];
      setProjects(list);

      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
        setLoading(false);
        return;
      }

      // 3) Load totals (planned + executed) via views
      const [{ data: plan, error: planErr }, { data: exec, error: execErr }] = await Promise.all([
        supabase.from("project_planned_totals").select("project_id, planned_minutes").in("project_id", ids),
        supabase.from("project_executed_totals").select("project_id, executed_minutes").in("project_id", ids),
      ]);

      if (seq !== loadSeq.current) return;

      if (planErr) console.warn("Load planned totals failed:", planErr);
      if (execErr) console.warn("Load executed totals failed:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of ((plan as any) ?? []) as TotalsRow[]) planMap[r.project_id] = (r.planned_minutes ?? 0) as number;

      const execMap: Record<string, number> = {};
      for (const r of ((exec as any) ?? []) as TotalsRow[]) execMap[r.project_id] = (r.executed_minutes ?? 0) as number;

      setPlannedByProject(planMap);
      setExecutedByProject(execMap);

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Projects page load failed:", e);
      setProjects([]);
      setOwners([]);
      setPlannedByProject({});
      setExecutedByProject({});
      setLoadError(e?.message ?? "Failed to load workspace/projects.");
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

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const ownerOk =
        filterOwner === "all"
          ? true
          : filterOwner === "none"
            ? p.owner_id === null
            : p.owner_id === filterOwner;

      const statusOk =
  filterStatus === "all"
    ? true
    : filterStatus === "open"
      ? p.status === "proposed" || p.status === "active"
      : p.status === filterStatus;


      return ownerOk && statusOk;
    });
  }, [projects, filterOwner, filterStatus]);

  const sortedProjects = useMemo(() => {
    const arr = [...filteredProjects];

    if (sortMode === "priority_desc") {
      arr.sort((a, b) => {
        const d = priorityRank(b.priority) - priorityRank(a.priority);
        if (d !== 0) return d;
        // Tiebreaker: newest first
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
      return arr;
    }

    // Default: newest first (already from DB, but keep deterministic)
    arr.sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    return arr;
  }, [filteredProjects, sortMode]);

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  const isStakeholder = role === "stakeholder";

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Projects</h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>
          
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/projects/new")}>
            {isStakeholder ? "Propose project" : "New project"}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="text-xs text-gray-500">Status</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="open">Open (proposed + active)</option>
              <option value="all">All</option>
              <option value="proposed">proposed</option>
              <option value="active">active</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Sort</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
            >
              <option value="newest">Newest</option>
              <option value="priority_desc">Priority (high → low)</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{sortedProjects.length}</span> of{" "}
          <span className="font-medium text-gray-700">{projects.length}</span> projects
        </div>
      </section>

      {/* Content states */}
      {loading ? (
        <div className="mt-8 text-gray-500">Loading…</div>
      ) : loadError ? (
        <div className="mt-8 text-gray-600">
          <div className="font-medium text-red-700">Could not load projects</div>
          <div className="mt-2 text-sm text-gray-600">{loadError}</div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="mt-8 text-gray-600">
          {projects.length === 0 ? "No projects found." : "No projects match the current filters."}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {sortedProjects.map((p) => {
            const executed = executedByProject[p.id] ?? 0;
            const planned = plannedByProject[p.id] ?? 0;
            const progress = calcPct(executed, planned);

            const ownerLabel =
              p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

            return (
              <li
                key={p.id}
                className="border rounded-lg p-4 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>

                    {p.description ? (
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={statusBadgeClass(p.status)}>{p.status}</span>
                      <span className={priorityBadgeClass(p.priority)}>{p.priority ?? "medium"}</span>
                      {p.project_type ? (
                        <span className={metaBadgeClass()}>{p.project_type}</span>
                      ) : null}
                      <span className={metaBadgeClass()}>Owner: {ownerLabel}</span>
                      {p.deadline ? (
                        <span className={metaBadgeClass()}>Deadline: {p.deadline}</span>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={progress} />
                      <div className="mt-1 text-xs text-gray-500">
                        Planned: {minutesToHoursText(planned)} • Executed: {minutesToHoursText(executed)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="outline" onClick={() => router.push(`/projects/${p.id}`)}>
                      Open
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
