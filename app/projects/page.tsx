"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

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
    if (!user) return;

    const ws = await getActiveWorkspace();
    if (!ws) {
      setLoading(false);
      alert("Geen workspace gevonden.");
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setRole(ws.role);

    const { data, error } = await supabase
      .from("projects")
      .select("id,name,description,inserted_at,status,owner_id,created_by")
      .eq("workspace_id", ws.workspaceId)
      .order("inserted_at", { ascending: false });

    if (error) alert(error.message);
    setProjects((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projecten</h1>
          <div className="text-sm text-gray-500">Rol: {role}</div>
        </div>

        <div className="flex gap-2">
          {(role === "owner" || role === "admin") && (
            <Button variant="outline" onClick={() => router.push("/admin/users")}>
              Gebruikers beheren
            </Button>
          )}
          <Button variant="outline" onClick={signOut}>
            Uitloggen
          </Button>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {workspaceId ? `Workspace: ${workspaceId}` : null}
        </div>
        <Button onClick={() => router.push("/projects/new")}>
          {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {projects.map((p) => (
            <li key={p.id} className="border rounded-lg p-4 flex justify-between gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {p.name}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "proposed" ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                {p.description ? <div className="text-sm text-gray-600 mt-1">{p.description}</div> : null}
              </div>
              <Button onClick={() => router.push(`/projects/${p.id}`)}>Open</Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
