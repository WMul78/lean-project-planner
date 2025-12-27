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
  estimated_minutes: number | null;
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

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h}u`;
}

function pct(spent: number, planned: number | null | undefined) {
  const p = planned ?? 0;
  if (p <= 0) return null;
  return Math.min(100, Math.round((spent / p) * 100));
}

export default function ProjectsPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<Project[]>([]);
  const [spentByProject, setSpentByProject] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // voorkomt race conditions: alleen de laatste load zet state
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
          setSpentByProject({});
          setLoadError("Geen workspace gevonden voor deze gebruiker.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,name,description,inserted_at,status,owner_id,created_by,deadline,priority,project_type,estimated_minutes"
        )
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (error) {
        console.error("Load projects error:", error);
        setProjects([]);
        setSpentByProject({});
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      const list = (data as Project[]) ?? [];
      setProjects(list);

      // totals per project ophalen (best effort)
      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setSpentByProject({});
        setLoading(false);
        return;
      }

      const { data: totals, error: totalsErr } = await supabase
        .from("project_time_totals")
        .select("project_id, spent_minutes")
        .in("project_id", ids);

      if (seq !== loadSeq.current) return;

      if (totalsErr) {
        console.error("Load totals error:", totalsErr);
        // Niet hard falen: lijst blijft bruikbaar
        setSpentByProject({});
      } else {
        const m: Record<string, number> = {};
        for (const row of (totals as any[]) ?? []) {
          m[row.project_id] = row.spent_minutes ?? 0;
        }
        setSpentByProject(m);
      }

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Projects page load failed:", e);
      setProjects([]);
      setSpentByProject({});
      setLoadError(e?.message ?? "Fout bij laden van workspace/projecten.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // reload wanneer WorkspaceSwitcher event fired (zoals in je huidige app)
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

          <Button variant="outline" onClick={() => router.push("/today")}>
            Vandaag
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
        <div className="mt-8 text-gray-600">
          Geen projecten gevonden.
          <div className="mt-2 text-sm text-gray-500">
            Als je verwacht projecten te zien: controleer of je workspace member bent en of je
            projects.workspace_id klopt.
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {projects.map((p) => {
            const planned = p.estimated_minutes ?? null;
            const spent = spentByProject[p.id] ?? 0;
            const progress = pct(spent, planned);

            return (
              <li
                key={p.id}
                className="border rounded-lg p-4 flex justify-between items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.name}</div>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForStatus(
                        p.status
                      )}`}
                    >
                      {p.status}
                    </span>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForPriority(
                        p.priority ?? "medium"
                      )}`}
                    >
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
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {p.description}
                    </div>
                  ) : null}

                  {/* Progress */}
                  {planned && planned > 0 ? (
                    <div className="mt-3">
                      <ProgressBar
                        value={progress ?? 0}
                        label={`${minutesToHoursText(spent)} / ${minutesToHoursText(planned)} (${
                          progress ?? 0
                        }%)`}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">
                      Geen planning ingevuld (estimated time).
                    </div>
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
