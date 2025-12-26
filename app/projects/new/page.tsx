"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

export default function ProjectNewPage() {
  const router = useRouter();
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await requireUser(router);
      if (!user) return;
      const ws = await getActiveWorkspace();
      if (!ws) {
        alert("Geen workspace gevonden.");
        router.push("/projects");
        return;
      }
      setRole(ws.role);
      setWorkspaceId(ws.workspaceId);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const user = await requireUser(router);
    if (!user || !workspaceId) return;

    const clean = name.trim();
    if (!clean) return;

    setSaving(true);

    const isStakeholder = role === "stakeholder";
    const payload = {
      workspace_id: workspaceId,
      name: clean,
      description: description.trim() || null,
      created_by: user.id,
      status: isStakeholder ? "proposed" : "active",
      owner_id: isStakeholder ? null : user.id,
    };

    const { data: proj, error } = await supabase
      .from("projects")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    // Voor members/admins: zet jezelf in project_members zodat je editor/owner rechten duidelijk zijn
    if (!isStakeholder && proj?.id) {
      const { error: pmErr } = await supabase.from("project_members").insert({
        project_id: proj.id,
        user_id: user.id,
        role: "owner",
      });
      if (pmErr) {
        // niet blokkeren, maar wel tonen
        console.warn(pmErr);
      }
    }

    setSaving(false);
    router.push(`/projects/${proj.id}`);
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <Button variant="outline" onClick={() => router.push("/projects")}>
        ← Terug
      </Button>

      <h1 className="text-xl font-semibold mt-4">
        {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
      </h1>

      <form onSubmit={submit} className="grid gap-3 mt-4">
        <input
          className="border rounded-md px-3 py-2"
          placeholder="Projectnaam"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border rounded-md px-3 py-2"
          placeholder="Omschrijving (optioneel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="text-sm text-gray-600">
          Status: <b>{role === "stakeholder" ? "proposed" : "active"}</b>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Opslaan..." : role === "stakeholder" ? "Voorstel indienen" : "Project aanmaken"}
        </Button>
      </form>
    </main>
  );
}
