"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

export default function ProjectNewPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const user = await requireUser(router);
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const ws = await getActiveWorkspace();
        if (!ws?.workspaceId) {
          alert("Geen workspace gevonden voor deze gebruiker.");
          router.push("/projects");
          return;
        }

        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      } catch (e: any) {
        console.error("Load workspace context failed:", e);
        alert(e?.message ?? "Fout bij laden van workspace context.");
        router.push("/projects");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 async function submit(e: React.FormEvent) {
  e.preventDefault();

  const { data: authData } = await supabase.auth.getUser();

  console.log("=== DEBUG PROJECT CREATE ===");
  console.log("auth user id:", authData?.user?.id);
  console.log("workspaceId:", workspaceId);
  console.log("role:", role);

  const payload = {
    workspace_id: workspaceId,
    name: name.trim(),
    description: description.trim() || null,
    created_by: authData?.user?.id,
    status: role === "stakeholder" ? "proposed" : "active",
    owner_id: role === "stakeholder" ? null : authData?.user?.id,
  };

  console.log("payload:", payload);
  console.log("============================");

  const { error } = await supabase.from("projects").insert(payload);

  if (error) {
    console.error("INSERT ERROR:", error);
    alert(error.message);
  }
}


  return (
    <main className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>
        <div className="text-sm text-gray-500">
          {workspaceId ? (
            <>
              Rol: {role} • <span className="text-gray-400">Workspace:</span>{" "}
              <span className="font-mono text-xs">{workspaceId}</span>
            </>
          ) : (
            <>Rol: {role}</>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-semibold mt-6">
        {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
      </h1>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <form onSubmit={submit} className="grid gap-3 mt-6">
          <input
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Projectnaam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <input
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Omschrijving (optioneel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="text-sm text-gray-600">
            Dit wordt opgeslagen als{" "}
            <span className="font-medium">
              {role === "stakeholder" ? "voorstel (proposed)" : "actief project (active)"}
            </span>
            .
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Opslaan..." : role === "stakeholder" ? "Voorstel indienen" : "Project aanmaken"}
            </Button>

            <Button variant="outline" type="button" onClick={() => router.push("/projects")} disabled={saving}>
              Annuleren
            </Button>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            Als je “new row violates row-level security” krijgt: check of <code>workspace_id</code>,{" "}
            <code>created_by</code>, <code>status</code> en (voor member/admin) <code>owner_id</code> worden
            meegestuurd.
          </div>
        </form>
      )}
    </main>
  );
}
