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
    if (saving) return;

    const user = await requireUser(router);
    if (!user) return;

    if (!workspaceId) {
      alert("Workspace ontbreekt. Ga terug naar projecten en probeer opnieuw.");
      return;
    }

    const cleanName = name.trim();
    const cleanDesc = description.trim();

    if (!cleanName) return alert("Vul een projectnaam in.");

    setSaving(true);

    // Extra debug om auth.uid() mismatch te voorkomen
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      setSaving(false);
      alert("Je sessie is niet geldig. Log opnieuw in.");
      router.push("/login");
      return;
    }

    const isStakeholder = role === "stakeholder";

    const payload = {
      workspace_id: workspaceId,
      name: cleanName,
      description: cleanDesc || null,
      created_by: authData.user.id,
      status: isStakeholder ? "proposed" : "active",
      owner_id: isStakeholder ? null : authData.user.id,
    };

    console.log("Creating project payload:", payload, "workspaceRole:", role);

    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .insert(payload)
      .select("id")
      .single();

    if (projErr) {
      console.error("Create project error:", projErr);
      alert(projErr.message);
      setSaving(false);
      return;
    }

    // Optioneel maar handig: zet creator als project member (owner/editor)
    // Dit helpt straks met je optie B permissions (member kan alleen bewerken als owner/editor).
    if (!isStakeholder) {
      const { error: pmErr } = await supabase.from("project_members").insert({
        project_id: proj.id,
        user_id: authData.user.id,
        role: "owner",
      });

      if (pmErr) {
        // Niet blokkeren, maar wel loggen
        console.warn("Failed to insert project_members owner row:", pmErr);
      }
    }

    setSaving(false);
    router.push(`/projects/${proj.id}`);
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
