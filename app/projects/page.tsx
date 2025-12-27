"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;
  status: "proposed" | "active" | "done" | "archived";
  owner_id: string | null;
  created_by: string;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const ws = await getActiveWorkspace();

      if (!ws?.workspaceId) {
        setLoading(false);
        alert("Geen workspace gevonden voor deze gebruiker.");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      const { data, error } = await supabase
        .from("projects")
        .select("id,name,description,inserted_at,status,owner_id,created_by")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (error) {
        console.error("Load projects error:", error);
        alert(error.message);
        setProjects([]);
      } else {
        setProjects((data as Project[]) ?? []);
      }
    } catch (e: any) {
      console.error("Projects page load failed:", e);
      alert(e?.message ?? "Fout bij laden van workspace/projecten.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projecten</h1>
          <div className="mt-2"><WorkspaceSwitcher /></div>
          <div className="text-sm text-gray-500">Rol: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">Workspace: {workspaceId}</div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={signOut}>
            Uitloggen
          </Button>

          <Button onClick={() => router.push("/projects/new")}>
            {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
          </Button>

          {(role === "owner" || role === "admin") && (
            <Button variant="outline" onClick={() => router.push("/admin/users")}>
              Gebruikers beheren
            </Button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="mt-8 text-gray-500">Laden...</div>
      ) : projects.length === 0 ? (
        <div className="mt-8 text-gray-600">
          Geen projecten gevonden.
          <div className="mt-2 text-sm text-gray-500">
            Als je verwacht projecten te zien: controleer of je workspace_members.role niet NULL is, en of je
            project.workspace_id klopt.
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={load}>
              Opnieuw laden
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {projects.map((p) => (
            <li key={p.id} className="border rounded-lg p-4 flex justify-between gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {p.name}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "proposed"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                {p.description ? (
                  <div className="text-sm text-gray-600 mt-1">{p.description}</div>
                ) : null}
              </div>

              <Button onClick={() => router.push(`/projects/${p.id}`)}>Open</Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
