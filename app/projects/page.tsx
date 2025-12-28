"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // YYYY-MM-DD
  priority: Priority | null;
  project_type: ProjectType | null;
};

function badgeClassForStatus(status: ProjectStatus) {
  switch (status) {
    case "proposed":
      return "bg-yellow-100 text-yellow-800";
    case "active":
      return "bg-blue-100 text-blue-800";
    case "done":
      return "bg-green-100 text-green-800";
    case "archived":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function badgeClassForPriority(priority: Priority | null | undefined) {
  switch (priority) {
    case "low":
      return "bg-gray-100 text-gray-700";
    case "medium":
      return "bg-blue-100 text-blue-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "very_high":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function labelProjectType(t: ProjectType | null | undefined) {
  return t ?? "standard";
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

export default function ProjectsPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<Project[]>([]);

  // ✅ nieuw: executed vs planned maps
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});
  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // race condition guard
  const loadSeq = useRef(0);

  const canManageUsers = useMemo(() => role === "owner" || role === "admin", [role]);

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
          setExecutedByProject({});
          setPlannedByProject({});
          setLoadError("Geen workspace gevonden voor deze gebruiker.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // ✅ Projects laden
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,description,inserted_at,status,owner_id,created_by,deadline,priority,project_type")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (error) {
        console.error("Load projects error:", error);
        setProjects([]);
        setExecutedByProject({});
        setPlannedByProject({});
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      const list = (data as Project[]) ?? [];
      setProjects(list);

      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setExecutedByProject({});
        setPlannedByProject({});
        setLoading(false);
        return;
      }

      // ✅ Executed totals (alleen t/m vandaag) per project
      const { data: exec, error: execErr } = await supabase
        .from("project_executed_totals")
        .select("project_id, executed_minutes")
        .in("project_id", ids);

      if (execErr) console.error("Load executed totals error:", execErr);

      // ✅ Planned totals (som todos.estimated_minutes) per project
      const { data: plan, error: planErr } = await supabase
        .from("project_planned_totals")
        .select("project_id, planned_minutes")
        .in("project_id", ids);

      if (planErr) console.error("Load planned totals error:", planErr);

      if (seq !== loadSeq.current) return;

      const executedMap: Record<string, number> = {};
      for (const row of (exec as any[]) ?? []) {
        executedMap[row.project_id] = row.executed_minutes ?? 0;
      }

      const plannedMap: Record<string, number> = {};
      for (const row of (plan as any[]) ?? []) {
        plannedMap[row.project_id] = row.planned_minutes ?? 0;
      }

      setExecutedByProject(executedMap);
      setPlannedByProject(plannedMap);

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Projects page load failed:", e);
      setProjects([]);
      setExecutedByProject({});
      setPlannedByProject({});
      setLoadError(e?.message ?? "Fout bij laden van workspace/projecten.");
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

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projecten</h1>

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

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={signOut}>
            Uitloggen
          </Button>

          <Button onClick={() => router.push("/projects/new")}>
            {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
          </Button>

          <Button variant="outline" onClick={() => router.push("/hours")}>
            Uren plannen
          </Button>

          {canManageUsers && (
            <Button variant="outline" onClick={() => router.push("/admin/users")}>
              Gebruikers beheren
            </Button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="mt-8 text-gray-500">Laden...</div>
      ) : loadError ? (
        <div className="mt-8 text-gray-600">
          <div className="font-medium text-red-700">Kon projecten niet laden</div>
          <div className="mt-2 text-sm text-gray-600">{loadError}</div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={load}>
              Opnieuw laden
            </Button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-8 text-gray-600">Geen projecten gevonden.</div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {projects.map((p) => {
            const executed = executedByProject[p.id] ?? 0;
            const planned = plannedByProject[p.id] ?? 0;
            const progress = planned > 0 ? Math.min(100, Math.round((executed / planned) * 100)) : null;

            return (
              <li key={p.id} className="border rounded-lg p-4 flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.name}</div>

                    <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForStatus(p.status)}`}>
                      {p.status}
                    </span>

                    <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForPriority(p.priority ?? "medium")}`}>
                      prio: {p.priority ?? "medium"}
                    </span>

                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      type: {labelProjectType(p.project_type)}
                    </span>

                    {p.deadline ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        deadline: {p.deadline}
                      </span>
                    ) : null}
                  </div>

                  {p.description ? (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
                  ) : null}

                  {/* ✅ Progress gebaseerd op tasks + executed (<= vandaag) */}
                  {planned > 0 ? (
                    <div className="mt-3">
                      <ProgressBar
                        value={progress ?? 0}
                        label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${progress ?? 0}%)`}
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Uitgevoerd telt alleen t/m vandaag. Toekomstige planning telt niet mee.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">Geen taak-ramingen ingevuld (planned = 0).</div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col gap-2 items-end">
                  <Button onClick={() => router.push(`/projects/${p.id}`)}>Open</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
