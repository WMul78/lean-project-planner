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
    setMembers(((mem as any) ?? []) as Member[]);

    // Invites: only show pending (so accepted/revoked/expired disappear)
    const { data: inv, error: invErr } = await supabase
      .from("workspace_invites")
      .select("id,workspace_id,email,role,status,token,created_at,expires_at")
      .eq("workspace_id", ws.workspaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invErr) alert(invErr.message);

    // Extra safety: filter pending in UI as well
    const pendingOnly = (((inv as any) ?? []) as Invite[]).filter((i) => i.status === "pending");
    setInvites(pendingOnly);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite() {
    if (!workspaceId) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email) return alert("Please enter an email address.");

    const { error } = await supabase.rpc("create_workspace_invite", {
      p_workspace_id: workspaceId,
      p_email: email,
      p_role: inviteRole,
    });

    if (error) return alert(error.message);

    setInviteEmail("");
    setInviteRole("stakeholder");
    load();
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase.from("workspace_invites").update({ status: "revoked" }).eq("id", inviteId);
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

  if (!isAdmin) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
          <div className="text-sm text-gray-500">Role: {role}</div>
        </div>

        <div className="mt-6 text-gray-700">You don’t have permission to manage users.</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Back
        </Button>
        <div className="text-sm text-gray-500">Role: {role}</div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">User management</h1>

      {/* Members list (FIRST) */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Members</h2>
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
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Invites (BOTTOM) */}
      <div className="mt-10 border rounded-lg p-4">
        <div className="font-medium">Invite someone (email)</div>
        <div className="text-sm text-gray-600 mt-1">
          Default role is <span className="font-medium">stakeholder</span> (you can change it).
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="email@domain.com"
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
          <Button onClick={createInvite}>Create invite</Button>
        </div>

        {/* Pending invites list */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Pending invitations</h2>

          {invites.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No pending invitations.</div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {invites
                .filter((i) => i.status === "pending")
                .map((i) => (
                  <li key={i.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-medium">{i.email}</div>
                      <div className="text-xs text-gray-500">
                        role: {i.role} • status: {i.status}
                      </div>

                      {/* MVP token display (only while pending) */}
                      <div className="text-xs text-gray-500 mt-1">
                        Token (MVP): <span className="font-mono">{i.token}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => revokeInvite(i.id)}>
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
