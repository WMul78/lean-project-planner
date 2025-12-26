"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Member = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<WorkspaceRole>("member");

  async function load() {
    const user = await requireUser(router);
    if (!user) return;

    const ws = await getActiveWorkspace();
    if (!ws) return router.push("/projects");

    setWorkspaceId(ws.workspaceId);
    setRole(ws.role);

    if (!(ws.role === "owner" || ws.role === "admin")) {
      router.push("/projects");
      return;
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select("id,workspace_id,user_id,role,created_at")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (error) alert(error.message);
    setMembers((data as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember() {
    if (!workspaceId) return;
    const clean = newUserId.trim();
    if (!clean) return;

    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: clean,
      role: newRole,
    });

    if (error) return alert(error.message);
    setNewUserId("");
    setNewRole("member");
    load();
  }

  async function updateRole(memberId: string, nextRole: WorkspaceRole) {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: nextRole })
      .eq("id", memberId);

    if (error) return alert(error.message);
    load();
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) return alert(error.message);
    load();
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>← Terug</Button>
        <div className="text-sm text-gray-500">Rol: {role}</div>
      </div>

      <h1 className="mt-4 text-xl font-semibold">Gebruikersbeheer</h1>

      <div className="mt-4 border rounded-lg p-4 grid gap-2">
        <div className="text-sm text-gray-600">Voeg lid toe (op user_id UUID)</div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="user_id (uuid)"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as WorkspaceRole)}
          >
            <option value="member">member</option>
            <option value="stakeholder">stakeholder</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
          <Button onClick={addMember}>Toevoegen</Button>
        </div>
      </div>

      <ul className="mt-6 grid gap-2">
        {members.map((m) => (
          <li key={m.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
            <div>
              <div className="font-medium">{m.user_id}</div>
              <div className="text-xs text-gray-500">{m.role}</div>
            </div>

            <div className="flex gap-2">
              <select
                className="border rounded-md px-2 py-1"
                value={m.role}
                onChange={(e) => updateRole(m.id, e.target.value as WorkspaceRole)}
              >
                <option value="member">member</option>
                <option value="stakeholder">stakeholder</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
              <Button variant="danger" onClick={() => removeMember(m.id)}>Verwijder</Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
