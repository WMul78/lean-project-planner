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
  profiles?: { email?: string | null; full_name?: string | null };
};

type Invite = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  token: string;
  created_at: string;
  expires_at: string | null;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("stakeholder");

  const isAdmin = useMemo(() => role === "owner" || role === "admin", [role]);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      router.push("/projects");
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setRole(ws.role);

    if (!(ws.role === "owner" || ws.role === "admin")) {
      setLoading(false);
      router.push("/projects");
      return;
    }

    // Members (top)
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,workspace_id,user_id,role,created_at,profiles(email,full_name)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) console.error(memErr);
    setMembers(((mem as any) ?? []) as Member[]);

    // Invites (only pending)
    const { data: inv, error: invErr } = await supabase
      .from("workspace_invites")
      .select("id,workspace_id,email,role,status,token,created_at,expires_at")
      .eq("workspace_id", ws.workspaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invErr) console.error(invErr);

    const pendingOnly = (((inv as any) ?? []) as Invite[]).filter((i) => i.status === "pending");
    setInvites(pendingOnly);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite() {
    if (!workspaceId) return;
    if (busy) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email) return alert("Please enter an email address.");

    setBusy(true);

    // 1) Create invite in DB (returns row incl. id)
    const { data, error } = await supabase.rpc("create_workspace_invite", {
      p_workspace_id: workspaceId,
      p_email: email,
      p_role: inviteRole,
    });

    if (error) {
      setBusy(false);
      return alert(error.message);
    }

    // 2) Send email via Edge Function (Resend)
    // If this fails, the invite still exists (pending) and can be retried.
    const inviteId = (data as any)?.id as string | undefined;

    if (inviteId) {
      const { error: fnErr } = await supabase.functions.invoke("send-workspace-invite", {
        body: { invite_id: inviteId },
      });

      if (fnErr) {
        console.error("Edge function send-workspace-invite failed:", fnErr);
        alert(
          "Invite created, but sending the email failed. You can retry by revoking and creating a new invite.\n\n" +
            fnErr.message
        );
      }
    } else {
      console.warn("No invite id returned from create_workspace_invite");
    }

    setInviteEmail("");
    setInviteRole("stakeholder");

    await load();
    setBusy(false);
  }

  async function revokeInvite(inviteId: string) {
    if (busy) return;
    setBusy(true);

    const { error } = await supabase.from("workspace_invites").update({ status: "revoked" }).eq("id", inviteId);

    setBusy(false);

    if (error) return alert(error.message);
    load();
  }

  async function updateMemberRole(memberId: string, nextRole: WorkspaceRole) {
    if (busy) return;
    setBusy(true);

    const { error } = await supabase.from("workspace_members").update({ role: nextRole }).eq("id", memberId);

    setBusy(false);

    if (error) return alert(error.message);
    load();
  }

  async function removeMember(memberId: string) {
    if (busy) return;
    if (!confirm("Remove this user from the workspace?")) return;

    setBusy(true);

    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);

    setBusy(false);

    if (error) return alert(error.message);
    load();
  }

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
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
        <div className="text-sm text-gray-500">
          Role: {role} {workspaceId ? `• Workspace: ${workspaceId.slice(0, 8)}…` : ""}
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">User management</h1>

      {/* Members (FIRST) */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="text-sm text-gray-500 mt-1">
          Manage workspace roles. (Owner/Admin only)
        </div>

        {members.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">No members found.</div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {members.map((m) => {
              const label =
                m.profiles?.full_name?.trim() ||
                m.profiles?.email ||
                m.user_id;

              return (
                <li key={m.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{label}</div>
                    <div className="text-xs text-gray-500">{m.role}</div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <select
                      className="border rounded-md px-2 py-1"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                    >
                      <option value="stakeholder">stakeholder</option>
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>

                    <Button variant="danger" onClick={() => removeMember(m.id)} disabled={busy}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Invites (BOTTOM) */}
      <section className="mt-10 border rounded-lg p-4">
        <div className="font-medium">Invite someone</div>
        <div className="text-sm text-gray-600 mt-1">
          An invitation email will be sent via Resend. Only <span className="font-medium">pending</span> invites are shown below.
        </div>

        <div className="mt-3 flex gap-2 flex-col sm:flex-row">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="email@domain.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={busy}
          />

          <select
            className="border rounded-md px-3 py-2"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
            disabled={busy}
          >
            <option value="stakeholder">stakeholder</option>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>

          <Button onClick={createInvite} disabled={busy}>
            {busy ? "Working…" : "Create invite"}
          </Button>
        </div>

        {/* Pending invites list */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Pending invitations</h2>

          {invites.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No pending invitations.</div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {invites.map((i) => (
                <li key={i.id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.email}</div>
                    <div className="text-xs text-gray-500">
                      role: {i.role} • status: {i.status}
                      {i.expires_at ? ` • expires: ${new Date(i.expires_at).toISOString().slice(0, 10)}` : ""}
                    </div>

                    {/* MVP token display (only while pending) */}
                    <div className="text-xs text-gray-500 mt-1">
                      Token (MVP): <span className="font-mono">{i.token}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="danger" onClick={() => revokeInvite(i.id)} disabled={busy}>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
