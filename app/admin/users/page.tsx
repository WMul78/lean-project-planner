"use client";

import { useEffect, useMemo, useState } from "react";
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
  profiles?: { email?: string | null };
};

type Invite = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("stakeholder");

  const isAdmin = useMemo(() => role === "owner" || role === "admin", [role]);

  async function load() {
    const user = await requireUser(router);
    if (!user) return;

    const ws = await getActiveWorkspace();
    if (!ws) {
      router.push("/projects");
      return;
    }
    setWorkspaceId(ws.workspaceId);
    setRole(ws.role);

    if (!(ws.role === "owner" || ws.role === "admin")) {
      router.push("/projects");
      return;
    }

    // Members + email via profiles
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,workspace_id,user_id,role,created_at,profiles(email)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) alert(memErr.message);
    setMembers((mem as any) ?? []);

    // Invites
    const { data: inv, error: invErr } = await supabase
      .from("workspace_invites")
      .select("id,workspace_id,email,role,status,token,created_at,expires_at")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: false });

    if (invErr) alert(invErr.message);
    setInvites((inv as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite() {
    if (!workspaceId) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return alert("Vul een geldig e-mailadres in.");

    const token = crypto.randomUUID(); // MVP token

    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user;
    if (!me) return router.push("/login");

    const { error } = await supabase.from("workspace_invites").insert({
      workspace_id: workspaceId,
      email,
      role: inviteRole,
      token,
      invited_by: me.id,
    });

    if (error) return alert(error.message);

    setInviteEmail("");
    setInviteRole("stakeholder");
    await load();

    // MVP: laat token zien zodat je kunt testen zonder e-mail
    alert(`Invite aangemaakt.\nToken:\n${token}\n\nLaat gebruiker naar /invites gaan en token plakken.`);
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId);

    if (error) return alert(error.message);
    load();
  }

  async function updateMemberRole(memberId: string, nextRole: WorkspaceRole) {
    const { error } = await supabase.from("workspace_members").update({ role: nextRole }).eq("id", memberId);
    if (error) return alert(error.message);
    load();
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) return alert(error.message);
    load();
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>
        <div className="text-sm text-gray-500">Rol: {role}</div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Gebruikersbeheer</h1>

      {/* Invite form */}
      <div className="mt-6 border rounded-lg p-4">
        <div className="font-medium">Nodig iemand uit (e-mail)</div>
        <div className="text-sm text-gray-600 mt-1">
          Standaard rol: stakeholder (kan je aanpassen).
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="email@domein.nl"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
          >
            <option value="stakeholder">stakeholder</option>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <Button onClick={createInvite}>Invite maken</Button>
        </div>
      </div>

      {/* Invites list */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Uitnodigingen</h2>
        <ul className="mt-3 grid gap-2">
          {invites.map((i) => (
            <li key={i.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
              <div>
                <div className="font-medium">{i.email}</div>
                <div className="text-xs text-gray-500">
                  role: {i.role} • status: {i.status}
                </div>
                {i.status === "pending" ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Token (MVP): <span className="font-mono">{i.token}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                {i.status === "pending" ? (
                  <Button variant="danger" onClick={() => revokeInvite(i.id)}>
                    Intrekken
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Members list */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold">Leden</h2>
        <ul className="mt-3 grid gap-2">
          {members.map((m) => (
            <li key={m.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
              <div>
                <div className="font-medium">{m.profiles?.email ?? m.user_id}</div>
                <div className="text-xs text-gray-500">{m.role}</div>
              </div>

              <div className="flex gap-2">
                <select
                  className="border rounded-md px-2 py-1"
                  value={m.role}
                  onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                >
                  <option value="stakeholder">stakeholder</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
                <Button variant="danger" onClick={() => removeMember(m.id)}>
                  Verwijder
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
