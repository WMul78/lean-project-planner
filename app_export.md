

## FILE: app\account\page.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { requireUser } from "@/app/lib/appContext";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const user = await requireUser(router);
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Load profile error:", error);
        alert(error.message);
        setLoading(false);
        return;
      }

      const p = data as Profile;
      setProfile(p);
      setFullName(p.full_name ?? "");

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (saving) return;

    const cleanName = fullName.trim();

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: cleanName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.error("Save profile error:", error);
      alert(error.message);
      return;
    }

    alert("Profile updated.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="text-gray-600">Profile not found.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <div className="text-sm text-gray-500">
            Manage your personal account details
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <form onSubmit={saveProfile} className="mt-6 grid gap-4">
        {/* Email */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Email</label>
          <input
            className="border rounded-md px-3 py-2 bg-gray-100 text-gray-700"
            value={email ?? ""}
            disabled
          />
          <div className="text-xs text-gray-500">
            Email address is managed via authentication settings.
          </div>
        </div>

        {/* Full name */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Full name</label>
          <input
            className="border rounded-md px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            disabled={saving}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={signOut}
            disabled={saving}
          >
            Sign out
          </Button>
        </div>
      </form>
    </main>
  );
}


```


## FILE: app\admin\users\page.tsx

```tsx
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

    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,workspace_id,user_id,role,created_at,profiles(email,full_name)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) console.error(memErr);
    setMembers(((mem as any) ?? []) as Member[]);

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

    try {
      // 1) Create invite in DB
      const { data, error } = await supabase.rpc("create_workspace_invite", {
        p_workspace_id: workspaceId,
        p_email: email,
        p_role: inviteRole,
      });

      if (error) return alert(error.message);

      const inviteId = (data as any)?.id as string | undefined;
      if (!inviteId) {
        console.warn("No invite id returned from create_workspace_invite", data);
        return alert("Invite created, but no invite ID was returned.");
      }

      // 2) Get token
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        console.error("getSession error:", sessErr);
        return alert("Invite created, but could not read session for sending the email.");
      }

      const accessToken = sessRes.session?.access_token;
      if (!accessToken) {
        return alert("Invite created, but you are not logged in (no session). Please log in again and retry.");
      }

      // 3) Send email via Edge Function
      const invokeRes = await supabase.functions.invoke("send-workspace-invite", {
        body: { invite_id: inviteId },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (invokeRes.error) {
        console.error("Edge function send-workspace-invite failed:", invokeRes.error);
        console.error("Edge function response data:", invokeRes.data);

        const details =
          typeof invokeRes.data === "string"
            ? invokeRes.data
            : invokeRes.data
            ? JSON.stringify(invokeRes.data, null, 2)
            : "";

        alert(
          "Invite created, but sending the email failed.\n\n" +
            (invokeRes.error.message || "Unknown error") +
            (details ? `\n\nDetails:\n${details}` : "")
        );
      } else {
        // ✅ Success (don’t rely on invokeRes.data)
        console.log("Invite email sent (edge ok):", invokeRes.data);
        setInviteEmail("");
        setInviteRole("stakeholder");
      }

      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (busy) return;
    setBusy(true);

    const { error } = await supabase
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId);

    setBusy(false);

    if (error) return alert(error.message);
    load();
  }

  async function updateMemberRole(memberId: string, nextRole: WorkspaceRole) {
    if (busy) return;
    setBusy(true);

    const { error } = await supabase
      .from("workspace_members")
      .update({ role: nextRole })
      .eq("id", memberId);

    setBusy(false);

    if (error) return alert(error.message);
    load();
  }

  async function removeMember(memberId: string) {
    if (busy) return;
    if (!confirm("Remove this user from the workspace?")) return;

    setBusy(true);

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);

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

      {/* Members */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="text-sm text-gray-500 mt-1">Manage workspace roles. (Owner/Admin only)</div>

        {members.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">No members found.</div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {members.map((m) => {
              const label = m.profiles?.full_name?.trim() || m.profiles?.email || m.user_id;

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

      {/* Invites (bottom) */}
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


```


## FILE: app\auth\callback\page.tsx

```tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      router.replace("/projects");
    });
  }, [router]);

  return <p>Confirming your account…</p>;
}


```


## FILE: app\components\ActionsMenu.tsx

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/Button";

export type ActionsMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export default function ActionsMenu({
  items,
  align = "right",
  icon = "dots",
}: {
  items: ActionsMenuItem[];
  align?: "left" | "right";
  icon?: "dots" | "gear";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const Icon = () => {
    if (icon === "gear") {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-gray-700">
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.24-1.12.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.39 1.05.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.24 1.12-.55 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
          />
        </svg>
      );
    }

    // dots
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" className="text-gray-700">
        <path
          fill="currentColor"
          d="M12 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 7Zm0 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 14Zm0 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 21Z"
        />
      </svg>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen((v) => !v)} aria-label="">
        <span className="inline-flex items-center gap-2">
          <Icon />
          <span className="hidden sm:inline"></span>
        </span>
      </Button>

      {open ? (
        <div
          className={[
            "absolute z-50 mt-2 w-56 rounded-lg border bg-white shadow-lg overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          <ul className="py-1">
            {items.map((it, idx) => (
              <li key={idx}>
                <button
                  className={[
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",
                    it.danger ? "text-red-600 hover:bg-red-50" : "text-gray-800",
                  ].join(" ")}
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}


```


## FILE: app\components\Button.tsx

```tsx
"use client";

import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "outline";
  disabled?: boolean;
  className?: string;
};


export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className,
}: ButtonProps) {
  const base =
    "px-4 py-2 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
  primary: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 hover:border-gray-400",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
  outline:
    "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 hover:border-gray-400",
};

  return (
    <button
  	type={type}
  	onClick={onClick}
  	disabled={disabled}
  	className={`${base} ${variants[variant]} ${className ?? ""}`}
       >
      {children}
    </button>
  );
}


```


## FILE: app\components\ProgressBar.tsx

```tsx
"use client";

export default function ProgressBar({
  value,
  label,
}: {
  value: number; // 0..100
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full">
      {label ? <div className="text-xs text-gray-600 mb-1">{label}</div> : null}
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-3 rounded-full bg-blue-600 transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}


```


## FILE: app\components\TopNav.tsx

```tsx
// app/components/TopNav.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, WorkspaceRole } from "@/app/lib/appContext";
import ActionsMenu from "@/app/components/ActionsMenu";
import Button from "@/app/components/Button";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const hideNav = useMemo(() => pathname === "/login", [pathname]);
  const canManageUsers = role === "owner" || role === "admin";

  const loadRole = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    setLoggedIn(!!user);

    if (!user) {
      setRole(null);
      return;
    }

    const ws = await getActiveWorkspace();
    setRole(ws?.role ?? null);
  }, []);

  useEffect(() => {
    if (hideNav) return;

    loadRole();

    // Re-evaluate role when workspace changes (or after role updates)
    const onWsChanged = () => loadRole();
    window.addEventListener("workspace-changed", onWsChanged);

    // Optional: refresh role when tab regains focus
    const onFocus = () => loadRole();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("workspace-changed", onWsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [hideNav, loadRole]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (hideNav || !loggedIn) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 hidden sm:block">Lean Planner</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/projects")}>Projects</Button>
            <Button variant="outline" onClick={() => router.push("/kanban")}>Kanban</Button>
            <Button variant="outline" onClick={() => router.push("/hours")}>Hours</Button>
          </div>
        </div>

        <ActionsMenu
          icon="dots"
          items={[
            { label: "Account", onClick: () => router.push("/account") },
            { label: "Manage users", onClick: () => router.push("/admin/users"), disabled: !canManageUsers },
            { label: "Sign out", onClick: signOut, danger: true },
          ]}
        />
      </div>
    </header>
  );
}


```


## FILE: app\components\WorkspaceSwitcher.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getWorkspaceList, getActiveWorkspace, setActiveWorkspace } from "@/app/lib/appContext";

type Ws = { workspaceId: string; name?: string; role: string };

export default function WorkspaceSwitcher() {
  const router = useRouter();

  const [list, setList] = useState<Ws[]>([]);
  const [active, setActive] = useState<Ws | null>(null);

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // NEW: create + rename UI
  const [showManage, setShowManage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const [newWsName, setNewWsName] = useState("");
  const [renameWsName, setRenameWsName] = useState("");

  const canRename = useMemo(() => {
    const r = active?.role;
    return r === "owner" || r === "admin";
  }, [active?.role]);

  async function load() {
    setLoading(true);
    try {
      const wsList = await getWorkspaceList();
      setList(wsList);

      const act = await getActiveWorkspace();
      setActive(act as any);

      // zet rename input alvast op huidige naam
      setRenameWsName((act as any)?.name ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onChange(id: string) {
    if (!id || id === active?.workspaceId) return;

    setSwitching(true);
    try {
      // 1) Persist: active workspace in profile
      await setActiveWorkspace(id);

      // 2) Update local UI instantly
      const next = list.find((w) => w.workspaceId === id) ?? null;
      setActive(next);

      // 3) update rename input
      setRenameWsName(next?.name ?? "");

      // 4) Tell the rest of the app to reload data
      window.dispatchEvent(new Event("workspace-changed"));

      // 5) Ensure we are on projects overview (optional)
      router.push("/projects");
    } catch (e: any) {
      console.error("Switch workspace failed:", e);
      alert(e?.message ?? "Wisselen van workspace mislukt.");
      await load();
    } finally {
      setSwitching(false);
    }
  }

  async function createWorkspace() {
    const name = newWsName.trim();
    if (!name) return;

    setCreating(true);
    try {
      // RPC uit stap 2
      const { data: newId, error } = await supabase.rpc("create_workspace", { p_name: name });
      if (error) throw error;

      setNewWsName("");

      // refresh lijst + active (RPC zet active_workspace_id al)
      await load();

      // Zorg dat UI meteen de nieuwe active pakt als jouw appContext nog niet refreshed is
      if (newId) {
        await setActiveWorkspace(newId as any);
      }

      window.dispatchEvent(new Event("workspace-changed"));
      router.push("/projects");
    } catch (e: any) {
      console.error("Create workspace failed:", e);
      alert(e?.message ?? "Workspace aanmaken mislukt.");
    } finally {
      setCreating(false);
    }
  }

  async function renameWorkspace() {
    if (!active?.workspaceId) return;
    if (!canRename) return;

    const name = renameWsName.trim();
    if (!name) return;

    setRenaming(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name })
        .eq("id", active.workspaceId);

      if (error) throw error;

      // update local list (sneller dan alles reloaden)
      setList((prev) =>
        prev.map((w) => (w.workspaceId === active.workspaceId ? { ...w, name } : w))
      );
      setActive((prev) => (prev ? { ...prev, name } : prev));

      window.dispatchEvent(new Event("workspace-changed"));
    } catch (e: any) {
      console.error("Rename workspace failed:", e);
      alert(e?.message ?? "Workspace naam wijzigen mislukt.");
      await load();
    } finally {
      setRenaming(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Workspace: laden…</div>;

  if (!active || list.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-600">Geen workspace</div>
        <Button variant="outline" onClick={() => router.push("/invites")}>
          Invite accepteren
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {/* Rij 1: switcher + beheer toggle */}
      <div className="flex items-center gap-2">
        <select
          className="border rounded-md px-2 py-1 text-sm disabled:opacity-50"
          value={active.workspaceId}
          onChange={(e) => onChange(e.target.value)}
          disabled={switching}
        >
          {list.map((w) => (
            <option key={w.workspaceId} value={w.workspaceId}>
              {w.name ?? w.workspaceId} ({w.role})
            </option>
          ))}
        </select>

        <Button
        variant="outline"
        onClick={() => setShowManage((v) => !v)}
        aria-label="Workspace actions"
        className="px-3"
        >
          ⋯
        </Button>

        {switching ? <span className="text-xs text-gray-500">wisselen…</span> : null}
      </div>

      {/* Rij 2: beheer panel */}
      {showManage ? (
        <div className="border rounded-lg p-3 bg-gray-50 grid gap-3">
          {/* Nieuwe workspace */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Nieuwe workspace</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Naam…"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
              />
              <Button onClick={createWorkspace} disabled={creating || newWsName.trim().length === 0}>
                {creating ? "Aanmaken…" : "Aanmaken"}
              </Button>
            </div>
          </div>

          {/* Hernoemen */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Huidige workspace naam</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Nieuwe naam…"
                value={renameWsName}
                onChange={(e) => setRenameWsName(e.target.value)}
                disabled={!canRename}
              />
              <Button
                variant="outline"
                onClick={renameWorkspace}
                disabled={!canRename || renaming || renameWsName.trim().length === 0}
              >
                {renaming ? "Opslaan…" : "Opslaan"}
              </Button>
            </div>
            {!canRename ? (
              <div className="text-xs text-gray-500">Alleen owner/admin kan de naam wijzigen.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}


```


## FILE: app\gantt\page.tsx

```tsx
// app/gantt/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

// ---- Types (keep minimal for MVP) ----
type WsMember = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  profiles?: { email?: string | null; full_name?: string | null };
};

type TimeEntryRow = {
  todo_id: string | null;
  project_id: string;
  entry_date: string; // YYYY-MM-DD
  minutes: number;
};

type TodoRow = {
  id: string;
  title: string;
  project_id: string;
  projects?: { name?: string | null } | null;
};

type ExecRow = { todo_id: string; executed_minutes: number | null };

// Frappe Gantt task shape
type GanttTask = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number; // 0..100
  custom_class?: string;
};

function labelForMember(m: WsMember) {
  const name = (m.profiles?.full_name ?? "").trim();
  const email = (m.profiles?.email ?? "").trim();
  return name || email || m.user_id;
}

function addOneDayISO(yyyyMmDd: string) {
  // Frappe Gantt treats end as exclusive-ish in some views; adding 1 day makes single-day tasks visible.
  // Safe and simple for read-only MVP.
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function GanttPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [members, setMembers] = useState<WsMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const ganttRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = workspaceRole === "owner" || workspaceRole === "admin";

  // Visible user options:
  // - owner/admin: can pick anyone in workspace
  // - others: forced to self (read-only for own plan)
  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  async function loadBase() {
    setLoading(true);
    setLoadError(null);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }
    setMyUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      setLoading(false);
      setLoadError("No active workspace found.");
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setWorkspaceRole(ws.role);

    // Load workspace members for the user filter
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("id,user_id,role,profiles(email,full_name)")
      .eq("workspace_id", ws.workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      console.error(memErr);
      setMembers([]);
      setLoadError(memErr.message);
      setLoading(false);
      return;
    }

    const list = (((mem as any) ?? []) as WsMember[]).filter((m) => !!m.user_id);
    setMembers(list);

    // Default selection:
    // - admin: self (if present), else first member
    // - non-admin: self
    const selfInList = list.find((m) => m.user_id === user.id)?.user_id;
    const initial = selfInList ?? list[0]?.user_id ?? user.id;
    setSelectedUserId(initial);

    setLoading(false);
  }

  async function loadGanttData(wsId: string, uid: string) {
    setLoadError(null);

    // 1) Load all planned entries for this workspace + user
    // Note: For very large datasets you’ll want date-range or server-side aggregation (v2).
    const { data: entries, error: eErr } = await supabase
      .from("time_entries")
      .select("todo_id,project_id,entry_date,minutes")
      .eq("workspace_id", wsId)
      .eq("user_id", uid)
      .order("entry_date", { ascending: true });

    if (eErr) {
      console.error(eErr);
      setTasks([]);
      setLoadError(eErr.message);
      return;
    }

    const rows = ((entries as any) ?? []) as TimeEntryRow[];
    const byTodo = new Map<
      string,
      { min: string; max: string; plannedMinutes: number; projectId: string }
    >();

    for (const r of rows) {
      if (!r.todo_id) continue;
      const id = r.todo_id;
      const cur = byTodo.get(id);
      const date = r.entry_date;
      const minutes = r.minutes ?? 0;

      if (!cur) {
        byTodo.set(id, { min: date, max: date, plannedMinutes: minutes, projectId: r.project_id });
      } else {
        if (date < cur.min) cur.min = date;
        if (date > cur.max) cur.max = date;
        cur.plannedMinutes += minutes;
      }
    }

    const todoIds = Array.from(byTodo.keys());
    if (todoIds.length === 0) {
      setTasks([]);
      return;
    }

    // 2) Load todo titles + project name (minimal fields)
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,project_id,projects(name)")
      .in("id", todoIds);

    if (tdErr) {
      console.error(tdErr);
      setTasks([]);
      setLoadError(tdErr.message);
      return;
    }

    const todos = ((td as any) ?? []) as TodoRow[];
    const todoById = new Map<string, TodoRow>();
    for (const t of todos) todoById.set(t.id, t);

    // 3) Load executed totals for progress (you already use this view elsewhere)
    const { data: ex, error: exErr } = await supabase
      .from("todo_executed_totals")
      .select("todo_id,executed_minutes")
      .in("todo_id", todoIds);

    if (exErr) console.warn("Load todo_executed_totals failed:", exErr);

    const execByTodo = new Map<string, number>();
    for (const r of (((ex as any) ?? []) as ExecRow[])) {
      execByTodo.set(r.todo_id, r.executed_minutes ?? 0);
    }

    // 4) Build Gantt tasks
    const ganttTasks: GanttTask[] = todoIds
      .map((id) => {
        const agg = byTodo.get(id)!;
        const todo = todoById.get(id);
        if (!todo) return null;

        const projectName = todo.projects?.name ?? "Project";
        const name = `${projectName} • ${todo.title}`;

        const planned = Math.max(0, agg.plannedMinutes);
        const executed = Math.max(0, execByTodo.get(id) ?? 0);
        const progress = planned > 0 ? Math.min(100, Math.round((executed / planned) * 100)) : 0;

        // Add +1 day to end so that a single-day planned task renders with visible width
        const endPlus = addOneDayISO(agg.max);

        return {
          id,
          name,
          start: agg.min,
          end: endPlus,
          progress,
          // Optional: custom CSS class (for future styling)
          custom_class: progress >= 100 ? "gantt-done" : "gantt-open",
        };
      })
      .filter(Boolean) as GanttTask[];

    // Sort: earliest first
    ganttTasks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    setTasks(ganttTasks);
  }

  // Load base (workspace + members)
  useEffect(() => {
    loadBase();
    // reload when workspace changes
    const handler = () => loadBase();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load gantt data when selection changes
  useEffect(() => {
    if (!workspaceId || !selectedUserId) return;
    loadGanttData(workspaceId, selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, selectedUserId]);

  // Render Frappe Gantt when tasks change
  useEffect(() => {
    if (!ganttRef.current) return;

    async function render() {
      // Dynamic import: avoids SSR issues
      const mod = await import("frappe-gantt");
      const Gantt = (mod as any).default;

      // Clear previous render
      ganttRef.current!.innerHTML = "";

      if (!tasks || tasks.length === 0) {
        ganttRef.current!.innerHTML =
          '<div class="text-sm text-gray-500 p-4">No planned tasks for this user.</div>';
        return;
      }

      // eslint-disable-next-line no-new
      new Gantt(ganttRef.current, tasks, {
        view_mode: "Week",
        bar_height: 22,
        padding: 18,
        // read-only MVP
        on_click: (task: any) => {
          // optional: jump to project/todo later
          console.log("Clicked:", task);
        },
      });
    }

    render();
  }, [tasks]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Gantt</h1>
          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>
          <div className="text-sm text-gray-500">Role: {workspaceRole}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">User</label>
            <select
              className="border rounded-md px-3 py-2"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={!isAdmin} // non-admin -> self only
            >
              {userOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {labelForMember(m)} ({m.role})
                </option>
              ))}
            </select>
            {!isAdmin ? (
              <div className="text-xs text-gray-500">
                You can only view your own planning in this workspace.
              </div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">What you see</label>
            <div className="text-sm text-gray-700">
              Bars run from <span className="font-medium">first planned day</span> to{" "}
              <span className="font-medium">last planned day</span> for{" "}
              <span className="font-medium">{selectedLabel || "selected user"}</span>.
            </div>
            <div className="text-xs text-gray-500">
              Progress is based on executed minutes vs planned minutes in that window.
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      {/* Gantt canvas */}
      <section className="mt-6 border rounded-lg bg-white p-2 overflow-x-auto">
        <div ref={ganttRef} />
      </section>

      <div className="mt-3 text-xs text-gray-500">
        Note: This is read-only MVP. For large workspaces, we’ll add date-range and server-side aggregation.
      </div>
    </main>
  );
}


```


## FILE: app\globals.css

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}


```


## FILE: app\hours\page.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser } from "@/app/lib/appContext";
import React from "react";

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  is_done: boolean;
  projects: { name: string } | null;
};

type EntryCell = {
  id: string;
  todo_id: string;
  project_id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  minutes: number;
  note: string | null;
};

function iso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

function minutesToHoursInput(min: number | null | undefined) {
  if (!min) return "";
  const h = Math.round((min / 60) * 10) / 10;
  return String(h);
}

function hoursInputToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export default function HoursPlannerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon–Fri

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key=todo|date

  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Explicit typing to avoid index/TS issues
  const [executedByTodo, setExecutedByTodo] = useState<Record<string, number>>({});

  const todayISO = useMemo(() => iso(new Date()), []);
  const [mobileDayIndex, setMobileDayIndex] = useState(0); // 0..4
  const mobileDay = days[mobileDayIndex];
  const mobileDayISO = mobileDay ? iso(mobileDay) : "";

  function cellKey(todoId: string, dateISO: string) {
    return `${todoId}|${dateISO}`;
  }

  async function load() {
    setLoading(true);

    try {
      const user = await requireUser(router);
      if (!user) return;

      setUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        alert("No workspace found.");
        router.push("/projects");
        return;
      }
      setWorkspaceId(ws.workspaceId);

      // 1) My tasks (assigned_to = me)
      const { data: td, error: tdErr } = await supabase
        .from("todos")
        .select("id,project_id,title,assigned_to,estimated_minutes,is_done,projects(name)")
        .eq("assigned_to", user.id)
        .eq("is_done", false) // only open tasks
        .order("project_id", { ascending: true })
        .order("inserted_at", { ascending: false });

      if (tdErr) {
        console.error(tdErr);
        alert(tdErr.message);
        setTodos([]);
        setCells({});
        setExecutedByTodo({});
        return;
      }

      const todoList = ((td as any) ?? []) as TodoRow[];
      setTodos(todoList);

      const ids = todoList.map((t) => t.id);
      if (ids.length === 0) {
        setCells({});
        setExecutedByTodo({});
        return;
      }

      // 2) Entries in this week (for me)
      const from = iso(days[0]);
      const to = iso(days[days.length - 1]);

      const { data: entries, error: eErr } = await supabase
        .from("time_entries")
        .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
        .in("todo_id", ids)
        .eq("user_id", user.id)
        .gte("entry_date", from)
        .lte("entry_date", to);

      if (eErr) {
        console.error(eErr);
        alert(eErr.message);
        setCells({});
      } else {
        const map: Record<string, EntryCell> = {};
        for (const en of ((entries as any) ?? []) as EntryCell[]) {
          map[cellKey(en.todo_id, en.entry_date)] = en;
        }
        setCells(map);
      }

      // 3) Executed totals per todo (<= today) via view
      const { data: ex, error: exErr } = await supabase
        .from("todo_executed_totals")
        .select("todo_id, executed_minutes")
        .in("todo_id", ids);

      if (exErr) {
        console.error(exErr);
        setExecutedByTodo({});
      } else {
        const m: Record<string, number> = {};
        for (const r of (ex as any[]) ?? []) {
          m[r.todo_id] = r.executed_minutes ?? 0;
        }
        setExecutedByTodo(m);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMobileDayIndex(0);
  }, [weekStart]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function setCell(todo: TodoRow, dateISO: string, hoursText: string) {
    if (!workspaceId || !userId) return;

    const key = cellKey(todo.id, dateISO);
    const minutes = hoursInputToMinutes(hoursText);

    // Empty => delete (if something existed)
    if (!minutes) {
      const existing = cells[key];
      if (!existing) return;

      setSavingKey(key);
      const { error } = await supabase.from("time_entries").delete().eq("id", existing.id);
      setSavingKey(null);

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      const copy = { ...cells };
      delete copy[key];
      setCells(copy);
      return;
    }

    // Upsert (requires unique index on todo_id, entry_date, user_id)
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId, // MVP: your own planner (later: assignee)
      logged_by: userId, // later: owner can plan for others
      entry_date: dateISO,
      minutes,
      note: null,
    };

    const { data, error } = await supabase
      .from("time_entries")
      .upsert(payload, { onConflict: "todo_id,entry_date,user_id" })
      .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
      .single();

    setSavingKey(null);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setCells({ ...cells, [key]: data as any });
  }

  function dayTotalMinutes(dateISO: string) {
    let sum = 0;
    for (const t of todos) {
      const c = cells[cellKey(t.id, dateISO)];
      if (c?.minutes) sum += c.minutes;
    }
    return sum;
  }

  function todoProgress(todo: TodoRow) {
    const planned = todo.estimated_minutes ?? 0;
    if (planned <= 0) return null;
    const exec = executedByTodo[todo.id] ?? 0;
    return Math.min(100, Math.round((exec / planned) * 100));
  }

  function nextWeek() {
    setWeekStart(addDays(weekStart, 7));
  }

  function prevWeek() {
    setWeekStart(addDays(weekStart, -7));
  }

  const grouped = useMemo(() => {
    const g = new Map<string, { projectId: string; projectName: string; items: TodoRow[] }>();
    for (const t of todos) {
      const name = t.projects?.name ?? "Project";
      const k = `${t.project_id}|${name}`;
      if (!g.has(k)) g.set(k, { projectId: t.project_id, projectName: name, items: [] });
      g.get(k)!.items.push(t);
    }
    return Array.from(g.values());
  }, [todos]);

  if (loading) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Plan hours (week)</h1>
          <div className="text-sm text-gray-500">
            Only your tasks. Future hours do not count toward progress.
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={prevWeek}>
              ← Previous
            </Button>
            <Button variant="outline" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
              Today
            </Button>
            <Button variant="outline" onClick={nextWeek}>
              Next →
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            Week starting <span className="font-medium">{iso(days[0])}</span>
          </div>
        </div>
      </header>

      {/* Mobile day picker */}
      <div className="mt-4 flex items-center justify-between md:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileDayIndex((i) => Math.max(0, i - 1))}
          disabled={mobileDayIndex === 0}
        >
          ←
        </Button>

        <div className="text-sm font-medium">
          {mobileDay
            ? mobileDay.toLocaleDateString(undefined, {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })
            : ""}
        </div>

        <Button
          variant="outline"
          onClick={() => setMobileDayIndex((i) => Math.min(4, i + 1))}
          disabled={mobileDayIndex === 4}
        >
          →
        </Button>
      </div>

      {todos.length === 0 ? (
        <div className="mt-8 text-gray-600">
          No tasks assigned to you.
          <div className="text-sm text-gray-500 mt-1">
            Assign tasks via <code>assigned_to</code> to plan them here.
          </div>
        </div>
      ) : (
        <>
          {/* DESKTOP: week table */}
          <div className="mt-6 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 340 }} />
                  {days.map((d) => (
                    <col key={iso(d)} style={{ width: 96 }} />
                  ))}
                  <col style={{ width: 160 }} />
                </colgroup>

                <thead>
                  <tr className="text-left bg-white">
                    <th className="border p-2 sticky left-0 bg-white z-10">Task</th>

                    {days.map((d) => {
                      const dISO = iso(d);
                      const label = d.toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      });

                      return (
                        <th key={dISO} className="border p-2">
                          {label}
                        </th>
                      );
                    })}

                    <th className="border p-2">Progress</th>
                  </tr>
                </thead>

                <tbody>
                  {grouped.map((grp) => (
                    <React.Fragment key={grp.projectId}>
                      <tr>
                        <td
                          className="border p-2 font-semibold bg-gray-50 sticky left-0 z-10"
                          colSpan={days.length + 2}
                        >
                          {grp.projectName}
                        </td>
                      </tr>

                      {grp.items.map((t) => {
                        const prog = todoProgress(t);
                        const exec = executedByTodo[t.id] ?? 0;

                        return (
                          <tr key={t.id}>
                            <td className="border p-2 align-top sticky left-0 bg-white z-10">
                              <div className="font-medium">{t.title}</div>
                              <div className="text-xs text-gray-500">
                                Planned: {minutesToHoursInput(t.estimated_minutes) || "—"}u
                              </div>
                            </td>

                            {days.map((d) => {
                              const dISO = iso(d);
                              const key = cellKey(t.id, dISO);
                              const value = minutesToHoursInput(cells[key]?.minutes);

                              return (
                                <td key={dISO} className="border p-2 align-top">
                                  <input
                                    className="w-full border rounded-md px-2 py-1 text-sm"
                                    defaultValue={value}
                                    placeholder="0"
                                    inputMode="decimal"
                                    disabled={savingKey === key}
                                    onBlur={(e) => setCell(t, dISO, e.target.value)}
                                  />
                                </td>
                              );
                            })}

                            <td className="border p-2 align-top">
                              {prog === null ? (
                                <span className="text-sm text-gray-500">—</span>
                              ) : (
                                <div className="text-sm">
                                  <span className="font-medium">{prog}%</span>
                                  <div className="text-xs text-gray-500">
                                    executed: {minutesToHoursText(exec)}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  <tr>
                    <td className="border p-2 font-semibold sticky left-0 bg-white z-10">Total</td>
                    {days.map((d) => {
                      const dISO = iso(d);
                      return (
                        <td key={dISO} className="border p-2 font-semibold">
                          {minutesToHoursText(dayTotalMinutes(dISO))}
                        </td>
                      );
                    })}
                    <td className="border p-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE: per day list */}
          <div className="mt-6 md:hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 260 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 140 }} />
                </colgroup>

                <thead>
                  <tr className="text-left bg-white">
                    <th className="border p-2">Task</th>
                    <th className="border p-2">Hours</th>
                    <th className="border p-2">Progress</th>
                  </tr>
                </thead>

                <tbody>
                  {grouped.map((grp) => (
                    <React.Fragment key={grp.projectId}>
                      <tr>
                        <td className="border p-2 font-semibold bg-gray-50" colSpan={3}>
                          {grp.projectName}
                        </td>
                      </tr>

                      {grp.items.map((t) => {
                        const prog = todoProgress(t);
                        const exec = executedByTodo[t.id] ?? 0;

                        const key = cellKey(t.id, mobileDayISO);
                        const value = minutesToHoursInput(cells[key]?.minutes);

                        return (
                          <tr key={t.id}>
                            <td className="border p-2 align-top">
                              <div className="font-medium">{t.title}</div>
                              <div className="text-xs text-gray-500">
                                Planned: {minutesToHoursInput(t.estimated_minutes) || "—"}u
                              </div>
                            </td>

                            <td className="border p-2 align-top">
                              <input
                                className="w-full border rounded-md px-2 py-1 text-sm"
                                defaultValue={value}
                                placeholder="0"
                                inputMode="decimal"
                                disabled={savingKey === key}
                                onBlur={(e) => setCell(t, mobileDayISO, e.target.value)}
                              />
                            </td>

                            <td className="border p-2 align-top">
                              {prog === null ? (
                                <span className="text-sm text-gray-500">—</span>
                              ) : (
                                <div className="text-sm">
                                  <span className="font-medium">{prog}%</span>
                                  <div className="text-xs text-gray-500">
                                    executed: {minutesToHoursText(exec)}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  <tr>
                    <td className="border p-2 font-semibold">Total</td>
                    <td className="border p-2 font-semibold">{minutesToHoursText(dayTotalMinutes(mobileDayISO))}</td>
                    <td className="border p-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Tip: edit a cell and click outside the input (onBlur) to save.
          </div>
        </>
      )}
    </main>
  );
}


```


## FILE: app\invite\accept\InviteAcceptClient.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

export default function InviteAcceptClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [status, setStatus] = useState<"loading" | "need_login" | "accepted" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Missing invite token.");
        return;
      }

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setStatus("need_login");
        setMessage("Please log in (or create an account) to accept the invitation.");
        return;
      }

      const { error } = await supabase.rpc("accept_workspace_invite", { p_token: token });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("accepted");
      setMessage("Invitation accepted. Redirecting…");

      setTimeout(() => {
        router.replace("/projects");
      }, 800);
    }

    run();
  }, [token, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Accepting invitation…</div>
      </main>
    );
  }

  if (status === "need_login") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-lg p-6">
          <h1 className="text-xl font-semibold">Accept invitation</h1>
          <p className="mt-2 text-sm text-gray-600">{message}</p>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`)}>
              Go to login
            </Button>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Login / Sign up
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-gray-700">{message}</p>

        {status === "error" ? (
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Go to projects
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}


```


## FILE: app\invite\accept\page.tsx

```tsx
"use client";

import { Suspense } from "react";
import Button from "@/app/components/Button";
import InviteAcceptClient from "./InviteAcceptClient";

function LoadingUI() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-gray-600">Accepting invitation…</div>
    </main>
  );
}

function ErrorFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-gray-700">Something went wrong.</p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => (window.location.href = "/projects")}>
            Go to projects
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <InviteAcceptClient />
    </Suspense>
  );
}


```


## FILE: app\invites\page.tsx

```tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function InvitesPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function accept() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.rpc("accept_workspace_invite", {
      invite_token: token.trim(),
    });

    setLoading(false);

    if (error) return alert(error.message);

    router.push("/projects");
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Invite accepteren</h1>
      <p className="text-sm text-gray-600 mt-2">
        Plak je invite-token hier (later vervangen we dit door een e-mail link).
      </p>

      <div className="mt-4 grid gap-2">
        <input
          className="border rounded-md px-3 py-2"
          placeholder="Invite token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button onClick={accept} disabled={loading}>
          {loading ? "Bezig…" : "Accepteer invite"}
        </Button>
      </div>
    </main>
  );
}


```


## FILE: app\kanban\page.tsx

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { statusBadgeClass, priorityBadgeClass, metaBadgeClass } from "@/app/lib/badges";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type Priority = "low" | "medium" | "high" | "very_high";
type ViewMode = "projects" | "todos" | "both";
type SortMode = "priority_desc" | "newest";

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority | null;
  project_type: string | null;
  deadline: string | null;
  owner_id: string | null;
  created_by: string;
  inserted_at: string;
};

type TodoAutoRow = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  is_done: boolean;
  executed_minutes: number;
  auto_status: "proposed" | "active" | "done"; // from view
};

type TotalsRowPlanned = { project_id: string; planned_minutes: number };
type TotalsRowExecuted = { project_id: string; executed_minutes: number };

type OwnerOption = { id: string; label: string };

const STATUS_COLUMNS: { key: ProjectStatus; label: string }[] = [
  { key: "proposed", label: "Proposed" },
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}h`;
}

function pct(executed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((executed / planned) * 100));
}

function priorityRank(p: Priority | null | undefined) {
  switch (p) {
    case "very_high":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 2;
  }
}

export default function ProjectsKanbanPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRef = useRef<ProjectRow[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const [todos, setTodos] = useState<TodoAutoRow[]>([]);

  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Filters (keep original behavior)
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "none" | string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag & drop (projects only) — keep original stable implementation
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  const loadSeq = useRef(0);

  // Stakeholders can view Kanban but should not be able to change project status.
  const canMoveProjects = role !== "stakeholder";

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
          setTodos([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setOwners([]);
          setLoadError("No workspace found.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // 1) Projects
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,workspace_id,name,description,status,priority,project_type,deadline,owner_id,created_by,inserted_at")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (prErr) {
        console.error(prErr);
        setProjects([]);
        setTodos([]);
        setLoadError(prErr.message);
        setLoading(false);
        return;
      }

      const projectList = ((pr as any) ?? []) as ProjectRow[];
      setProjects(projectList);

      // 2) Owners (workspace_members + profiles)
      const { data: mem, error: memErr } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(full_name,email)")
        .eq("workspace_id", ws.workspaceId)
        .order("created_at", { ascending: true });

      if (memErr) {
        console.warn("Load owners failed:", memErr);
        setOwners([]);
      } else {
        const opts: OwnerOption[] = ((mem as any[]) ?? []).map((m) => {
          const id = m.user_id as string;
          const full = m.profiles?.full_name as string | null | undefined;
          const email = m.profiles?.email as string | null | undefined;
          const label = (full && full.trim()) || email || id.slice(0, 8);
          return { id, label };
        });
        setOwners(opts);
      }

      const ids = projectList.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
        setTodos([]);
        setLoading(false);
        return;
      }

      // 3) Totals via views
      const [{ data: plan, error: planErr }, { data: exec, error: execErr }] = await Promise.all([
        supabase.from("project_planned_totals").select("project_id, planned_minutes").in("project_id", ids),
        supabase.from("project_executed_totals").select("project_id, executed_minutes").in("project_id", ids),
      ]);

      if (seq !== loadSeq.current) return;

      if (planErr) console.warn("planned totals error:", planErr);
      if (execErr) console.warn("executed totals error:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of (((plan as any) ?? []) as TotalsRowPlanned[])) planMap[r.project_id] = r.planned_minutes ?? 0;
      setPlannedByProject(planMap);

      const execMap: Record<string, number> = {};
      for (const r of (((exec as any) ?? []) as TotalsRowExecuted[])) execMap[r.project_id] = r.executed_minutes ?? 0;
      setExecutedByProject(execMap);

      // 4) Todos via view todo_status_auto (no workspace_id -> filter by project_id)
      // MVP: do not show "done" tasks in Kanban
      const { data: td, error: tdErr } = await supabase
        .from("todo_status_auto")
        .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,is_done,executed_minutes,auto_status")
        .in("project_id", ids)
       // .neq("auto_status", "done")
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (tdErr) {
        console.warn("Load todos failed:", tdErr);
        setTodos([]);
      } else {
        setTodos(((td as any) ?? []) as TodoAutoRow[]);
      }

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Kanban load failed:", e);
      setProjects([]);
      setTodos([]);
      setPlannedByProject({});
      setExecutedByProject({});
      setOwners([]);
      setLoadError(e?.message ?? "Failed to load.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [load]);

  // ---- Filters / sorting projects ----
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const prioOk = filterPriority === "all" ? true : (p.priority ?? "medium") === filterPriority;

      const ownerOk =
        filterOwner === "all"
          ? true
          : filterOwner === "none"
            ? p.owner_id === null
            : p.owner_id === filterOwner;

      return prioOk && ownerOk;
    });
  }, [projects, filterPriority, filterOwner]);

  const sortedFilteredProjects = useMemo(() => {
    const arr = [...filteredProjects];
    if (sortMode === "priority_desc") {
      arr.sort((a, b) => {
        const d = priorityRank(b.priority) - priorityRank(a.priority);
        if (d !== 0) return d;
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    } else {
      arr.sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    }
    return arr;
  }, [filteredProjects, sortMode]);

  const projectById = useMemo(() => {
    const m: Record<string, ProjectRow> = {};
    for (const p of projects) m[p.id] = p;
    return m;
  }, [projects]);

  const filteredProjectIds = useMemo(() => new Set(sortedFilteredProjects.map((p) => p.id)), [sortedFilteredProjects]);

  // ---- Tasks follow project filters (owner/priority), but get their own column status ----
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => filteredProjectIds.has(t.project_id));
  }, [todos, filteredProjectIds]);

  // Task -> Kanban column status:
  // - if project is archived => task appears in archived column
  // - else use auto_status (proposed/active/done)
  const todoColumnStatus = useCallback(
    (t: TodoAutoRow): ProjectStatus => {
      const p = projectById[t.project_id];
      if (p?.status === "archived") return "archived";
      return t.auto_status; // proposed | active | done
    },
    [projectById]
  );

  const todosByColumn = useMemo(() => {
    const m: Record<ProjectStatus, TodoAutoRow[]> = { proposed: [], active: [], done: [], archived: [] };
    for (const t of filteredTodos) {
      m[todoColumnStatus(t)].push(t);
    }

    // Sort tasks by project priority (high -> low), then by newest
    for (const k of Object.keys(m) as ProjectStatus[]) {
      m[k].sort((a, b) => {
        const pa = projectById[a.project_id]?.priority;
        const pb = projectById[b.project_id]?.priority;
        const d = priorityRank(pb) - priorityRank(pa);
        if (d !== 0) return d;
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
    }

    return m;
  }, [filteredTodos, projectById, todoColumnStatus]);

  const projectsByColumn = useMemo(() => {
    const m: Record<ProjectStatus, ProjectRow[]> = { proposed: [], active: [], done: [], archived: [] };
    for (const p of sortedFilteredProjects) m[p.status].push(p);
    return m;
  }, [sortedFilteredProjects]);

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  async function updateProjectStatus(projectId: string, nextStatus: ProjectStatus) {
    const prev = projectsRef.current;
    setProjects((cur) => cur.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)));

    const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);
    if (error) {
      console.error(error);
      alert(error.message);
      setProjects(prev);
    }
  }

  function ProjectCard({ p, compact }: { p: ProjectRow; compact?: boolean }) {
    const planned = plannedByProject[p.id] ?? 0;
    const executed = executedByProject[p.id] ?? 0;
    const percent = pct(executed, planned);
    const ownerLabel = p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

    return (
      <div
        draggable={canMoveProjects}
        style={{ cursor: canMoveProjects ? "grab" : "default" }}
        onDragStart={(e) => {
          if (!canMoveProjects) return;
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          requestAnimationFrame(() => setDraggingId(p.id));
        }}
        onDragEnd={() => {
          if (!canMoveProjects) return;
          setDraggingId(null);
          setDragOverStatus(null);
         }}
        className={[
          "rounded-lg border bg-white p-3 shadow-sm hover:shadow transition-shadow",
          "w-full max-w-full overflow-hidden",
          draggingId === p.id ? "opacity-60 ring-2 ring-blue-400" : "",
          !canMoveProjects ? "select-text" : "",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            {!compact && p.description ? (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
            ) : null}
          </div>

          <Button variant="outline" className="shrink-0" onClick={() => router.push(`/projects/${p.id}`)}>
            Open
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className={statusBadgeClass(p.status)}>{p.status}</span>
          <span className={priorityBadgeClass(p.priority)}>priority: {p.priority ?? "medium"}</span>
          {p.project_type ? <span className={metaBadgeClass()}>type: {p.project_type}</span> : null}
          {p.deadline ? <span className={metaBadgeClass()}>deadline: {p.deadline}</span> : null}
          <span className={metaBadgeClass()}>owner: {ownerLabel}</span>
        </div>

        <div className="mt-2 md:hidden">
          <label className="text-[11px] text-gray-500">Project status</label>
          <select
            className="mt-1 w-full border rounded-md px-2 py-1 text-sm"
            value={p.status}
            onChange={(e) => updateProjectStatus(p.id, e.target.value as ProjectStatus)}
          >
            {STATUS_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {!compact ? (
          <div className="mt-3">
            {planned > 0 ? (
              <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
            ) : (
              <div className="text-sm text-gray-500">No estimate (planned = 0)</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function TodoCard({ t }: { t: TodoAutoRow }) {
    const p = projectById[t.project_id];
    const projectName = p?.name ?? "Project";
    const prio = p?.priority ?? "medium";
    const planned = t.estimated_minutes ?? 0;
    const executed = t.executed_minutes ?? 0;
    const percent = planned > 0 ? pct(executed, planned) : 0;

    return (
      <div className="rounded-md border bg-white px-3 py-2 w-full max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{t.title}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className={metaBadgeClass()}>project: {projectName}</span>
              <span className={priorityBadgeClass(prio)}>priority: {prio}</span>
              {planned > 0 ? (
                <span className={metaBadgeClass()}>
                  {minutesToHoursText(executed)} / {minutesToHoursText(planned)} ({percent}%)
                </span>
              ) : (
                <span className={metaBadgeClass()}>no estimate</span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="text-xs px-2 py-1 shrink-0"
            onClick={() => router.push(`/projects/${t.project_id}`)}
          >
            Open
          </Button>
        </div>

        {planned > 0 ? (
          <div className="mt-2">
            <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
          </div>
        ) : null}

        <div className="mt-2 text-[11px] text-gray-500">
          Status is automatic based on progress: 0% proposed, 1–99% active, 100% done.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects • Kanban</h1>
          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>

          {/* Workspace ID intentionally not shown */}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Priority</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Owner</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">View</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="projects">Projects</option>
              <option value="todos">Tasks</option>
              <option value="both">Projects + tasks</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Sort</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Priority (high → low)</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      <section className="mt-6">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1080px] grid grid-cols-[repeat(4,260px)] gap-4">
            {STATUS_COLUMNS.map((col) => (
              <div
              key={col.key}
              className={[
                "rounded-lg border bg-gray-50 transition-colors",
                canMoveProjects && dragOverStatus === col.key
                  ? "ring-2 ring-blue-400 bg-blue-50/30"
                  : "",
              ].join(" ")}
              onDragOver={(e) => {
              if (!canMoveProjects) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(col.key);
              }}
              onDragLeave={() => {
                if (!canMoveProjects) return;
                setDragOverStatus((s) => (s === col.key ? null : s));
              }}
              onDrop={async (e) => {
                if (!canMoveProjects) return;
                e.preventDefault();

                const pid = e.dataTransfer.getData("text/plain");
               setDragOverStatus(null);
               setDraggingId(null);

               if (!pid) return;

               const p = projectsRef.current.find((x) => x.id === pid);
                if (!p) return;
                if (p.status === col.key) return;

                await updateProjectStatus(pid, col.key);
              }}
            >
                <div className="px-3 py-2 border-b bg-white rounded-t-lg flex items-center justify-between">
                  <div className="font-semibold">{col.label}</div>
                  <div className="text-xs text-gray-500">
                    {projectsByColumn[col.key].length} proj • {todosByColumn[col.key].length} tasks
                  </div>
                </div>

                <div className="p-3 grid gap-3">
                  {/* Projects */}
                  {viewMode === "projects" || viewMode === "both" ? (
                    projectsByColumn[col.key].length === 0 ? (
                      <div className="text-sm text-gray-500">No projects</div>
                    ) : (
                      projectsByColumn[col.key].map((p) => <ProjectCard key={p.id} p={p} compact={false} />)
                    )
                  ) : null}

                  {/* Tasks */}
                  {viewMode === "todos" || viewMode === "both" ? (
                    todosByColumn[col.key].length === 0 ? (
                      <div className="text-sm text-gray-500">No tasks</div>
                    ) : (
                      todosByColumn[col.key].map((t) => <TodoCard key={t.id} t={t} />)
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Task status is automatically determined based on progress (hours logged up to today).
        </div>
      </section>
    </main>
  );
}


```


## FILE: app\layout.tsx

```tsx
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/components/TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: "Lean Project Planner",
  title: "Lean Project Planner",
  description: "Lean project planner (Kaizen / PDCA / DMAIC)",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TopNav />
        {/* Add top padding to account for the fixed navigation bar */}
        <div className="pt-[72px]">{children}</div>
      </body>
    </html>
  );
}


```


## FILE: app\lib\appContext.ts

```ts
// app/lib/appContext.ts
import { supabase } from "@/lib/supabaseClient";

export type WorkspaceRole = "owner" | "admin" | "member" | "stakeholder";

export async function requireUser(router?: { push: (p: string) => void }) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    router?.push("/login");
    return null;
  }
  return data.user;
}

export async function getWorkspaceList() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id) // <-- essentieel
    .order("created_at", { ascending: true });

  if (error) throw error;

  // dedupe op workspaceId (voor de zekerheid)
  const map = new Map<string, { workspaceId: string; role: WorkspaceRole; name?: string }>();
  for (const m of (data ?? []) as any[]) {
    map.set(m.workspace_id, {
      workspaceId: m.workspace_id,
      role: (m.role as WorkspaceRole) ?? "member",
      name: m.workspaces?.name,
    });
  }

  return Array.from(map.values());
}


export async function getActiveWorkspace() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const list = await getWorkspaceList();
  if (list.length === 0) return null;

  const byProfile = profile?.active_workspace_id
    ? list.find((w) => w.workspaceId === profile.active_workspace_id)
    : null;

  // ✅ Fix 2: zet dit hier
  if (profile?.active_workspace_id && !byProfile) {
    console.warn(
      "active_workspace_id not in membership list",
      profile.active_workspace_id,
      list.map((w) => w.workspaceId)
    );
  }

  return byProfile ?? list[0];
}


export async function setActiveWorkspace(workspaceId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);

  if (error) throw error;
}




```


## FILE: app\lib\badges.ts

```ts
// app/lib/badges.ts

export const badgeBase =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

// Exact dezelfde mapping als in projects/page.tsx
export function badgeClassForStatus(status: string) {
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

export function badgeClassForPriority(priority: string | null | undefined) {
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

export function badgeClassForTaskStatus(status: string) {
  switch (status) {
    case "todo":
      return "bg-gray-100 text-gray-700";
    case "doing":
      return "bg-blue-100 text-blue-800";
    case "blocked":
      return "bg-red-100 text-red-800";
    case "done":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function taskStatusBadgeClass(status: string) {
  return `${badgeBase} ${badgeClassForTaskStatus(status)}`;
}


// Handige helpers: direct "base + kleur"
export function statusBadgeClass(status: string) {
  return `${badgeBase} ${badgeClassForStatus(status)}`;
}

export function priorityBadgeClass(priority: string | null | undefined) {
  return `${badgeBase} ${badgeClassForPriority(priority)}`;
}

// Voor neutrale badges zoals type/deadline
export function metaBadgeClass() {
  return `${badgeBase} bg-gray-100 text-gray-700`;
}


```


## FILE: app\login\page.tsx

```tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) return alert(error.message);
    router.push("/projects");
  }

  async function signUp() {
  setIsLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Optional: help debugging email confirm flows
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  setIsLoading(false);

  console.log("SIGNUP RESULT", {
    data,
    error,
    // Some Supabase errors have extra fields
    status: (error as any)?.status,
    code: (error as any)?.code,
    name: (error as any)?.name,
    message: (error as any)?.message,
  });

  if (error) {
    alert(
      `SignUp failed:\n` +
        JSON.stringify(
          {
            message: error.message,
            status: (error as any)?.status,
            code: (error as any)?.code,
            name: (error as any)?.name,
          },
          null,
          2
        )
    );
    return;
  }

  alert("Account aangemaakt. Als email-confirm aan staat: check je inbox.");
}


  return (
  <main className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold mb-4 text-center">
        Login
      </h1>

      <form onSubmit={signIn} className="grid gap-3">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="wachtwoord"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            type="submit"
            disabled={isLoading}
            className="flex-1"
          >
            Inloggen
          </Button>

          <Button
            variant="secondary"
            onClick={signUp}
            disabled={isLoading}
            className="flex-1"
          >
            Registreren
          </Button>
        </div>
      </form>
    </div>
  </main>
);

}


```


## FILE: app\manifest.ts

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lean Project Planner",
    short_name: "Lean Planner",
    description: "Lean project planner (Kaizen / PDCA / DMAIC)",
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}


```


## FILE: app\page.tsx

```tsx
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}


```


## FILE: app\projects\[id]\edit\page.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived"; // later maybe "on_hold"

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // ISO date (YYYY-MM-DD)
  estimated_minutes: number | null;
  priority: Priority;
  project_type: ProjectType;
  phase: string | null;
  location_link: string | null;
};

const PHASES: Record<ProjectType, { value: string; label: string }[]> = {
  standard: [],
  pdca: [
    { value: "plan", label: "Plan" },
    { value: "do", label: "Do" },
    { value: "check", label: "Check" },
    { value: "act", label: "Act" },
  ],
  dmaic: [
    { value: "define", label: "Define" },
    { value: "measure", label: "Measure" },
    { value: "analyze", label: "Analyze" },
    { value: "improve", label: "Improve" },
    { value: "control", label: "Control" },
  ],
};

function minutesToHoursText(min: number | null) {
  if (!min || min <= 0) return "";
  const hours = Math.round((min / 60) * 10) / 10; // 1 decimal
  return String(hours);
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

export default function ProjectEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState<ProjectRow | null>(null);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD or ""
  const [estimatedHours, setEstimatedHours] = useState<string>(""); // UI in hours
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState<string>("");
  const [locationLink, setLocationLink] = useState<string>("");

  const canEdit = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: only edit own proposal (MVP: only if proposed + created_by=self)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    // Project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select(
        "id,workspace_id,name,description,status,owner_id,created_by,deadline,estimated_minutes,priority,project_type,phase,location_link"
      )
      .eq("id", projectId)
      .single();

    if (projErr) {
      setLoading(false);
      alert(projErr.message);
      router.push(`/projects/${projectId}`);
      return;
    }

    const pr = proj as ProjectRow;
    setProject(pr);

    // Project membership role (for member collaboration)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    setProjectMemberRole((pm as any)?.role ?? null);

    // init form
    setName(pr.name ?? "");
    setDescription(pr.description ?? "");
    setDeadline(pr.deadline ?? "");
    setEstimatedHours(minutesToHoursText(pr.estimated_minutes));
    setPriority(pr.priority ?? "medium");
    setStatus(pr.status ?? "active");
    setProjectType(pr.project_type ?? "standard");
    setPhase(pr.phase ?? "");
    setLocationLink(pr.location_link ?? "");

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // When type changes: validate/reset phase
  useEffect(() => {
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (!phase) return;

    if (projectType === "standard") {
      setPhase("");
      return;
    }

    if (!allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!canEdit) return alert("You don't have permission to edit this project.");
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Please enter a title.");

    // Basic validation for location link
    const loc = locationLink.trim();
    if (loc && loc.length > 500) return alert("Location link is too long.");

    // phase: if standard => null
    const nextPhase = projectType === "standard" ? null : phase.trim() ? phase.trim() : null;

    // deadline: "" => null
    const nextDeadline = deadline ? deadline : null;

    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours); // null if empty/invalid

    setSaving(true);

    const payload = {
      name: cleanName,
      description: description.trim() || null,
      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      status,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { error } = await supabase.from("projects").update(payload).eq("id", project.id);

    setSaving(false);

    if (error) {
      console.error("Update project error:", error);
      alert(error.message);
      return;
    }

    router.push(`/projects/${project.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Project not found.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push(`/projects/${project.id}`)}>
          ← Back
        </Button>

        <div className="text-sm text-gray-500">
          Workspace role: {workspaceRole} {projectMemberRole ? `• Project role: ${projectMemberRole}` : ""}
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Edit project</h1>
      <div className="mt-1 text-sm text-gray-500">
        {project.name} {!canEdit ? "• Read-only" : null}
      </div>

      {!canEdit ? (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50 text-sm text-gray-700">
          You don't have permission to modify this project.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Title */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* Description */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[110px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Estimate */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 2"
              inputMode="decimal"
              disabled={saving}
            />
          </div>

          {/* Priority */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          {/* Status */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={saving}
            >
              <option value="proposed">proposed</option>
              <option value="active">active</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Project type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              disabled={saving}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>

          {/* Phase */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select
              className="border rounded-md px-3 py-2"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              disabled={saving || projectType === "standard"}
            >
              <option value="">—</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">Only applicable for PDCA/DMAIC projects.</div>
          </div>
        </div>

        {/* Location link */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. https://... or a file path (later)"
            disabled={saving}
          />
          <div className="text-xs text-gray-500">
            MVP: free text. Later you can validate URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push(`/projects/${project.id}`)}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}


```


## FILE: app\projects\[id]\page.tsx

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, badgeClassForStatus, badgeClassForPriority, metaBadgeClass } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

const PHASES: Record<Exclude<ProjectType, "standard">, { value: string; label: string }[]> = {
  pdca: [
    { value: "plan", label: "Plan" },
    { value: "do", label: "Do" },
    { value: "check", label: "Check" },
    { value: "act", label: "Act" },
  ],
  dmaic: [
    { value: "define", label: "Define" },
    { value: "measure", label: "Measure" },
    { value: "analyze", label: "Analyze" },
    { value: "improve", label: "Improve" },
    { value: "control", label: "Control" },
  ],
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // YYYY-MM-DD
  priority: Priority | null;
  project_type: ProjectType | null;
  phase: string | null;
  location_link: string | null;
};

type TodoAuto = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number; // from view todo_executed_totals / todo_status_auto
  auto_status: "proposed" | "active" | "done"; // from view
  // NEW (requires view/table update)
  phase: string | null;
  sort_order: number | null;
};

type Member = { id: string; full_name: string; email: string | null };

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h}h`;
}

function minutesToHoursInput(min: number | null | undefined) {
  if (!min) return "";
  const h = Math.round((min / 60) * 10) / 10;
  return String(h);
}

function hoursInputToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return null;
  return Math.min(100, Math.round((executed / planned) * 100));
}

function clampPhase(projectType: ProjectType | null | undefined, phase: string | null | undefined) {
  if (!projectType || projectType === "standard") return null;
  if (!phase) return null;
  const allowed = new Set(PHASES[projectType].map((p) => p.value));
  return allowed.has(phase) ? phase : null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<TodoAuto[]>([]);
  const todosRef = useRef<TodoAuto[]>([]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const [members, setMembers] = useState<Member[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // UI prefs
  const [hideDoneTasks, setHideDoneTasks] = useState<boolean>(true);

  // drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const canEditProject = useMemo(() => workspaceRole === "owner" || workspaceRole === "admin", [workspaceRole]);

  // Members can edit tasks if they are project member (or owner/admin via workspace)
  const canEditTodos = useMemo(() => {
    if (workspaceRole === "owner" || workspaceRole === "admin") return true;
    return projectMemberRole === "member" || projectMemberRole === "owner" || projectMemberRole === "admin";
  }, [workspaceRole, projectMemberRole]);

  const isStakeholder = useMemo(() => workspaceRole === "stakeholder", [workspaceRole]);

  const filteredTodos = useMemo(() => {
    if (!hideDoneTasks) return todos;
    return todos.filter((t) => t.auto_status !== "done");
  }, [todos, hideDoneTasks]);

  const sortedTodos = useMemo(() => {
    // stable sort: sort_order first, then inserted_at
    const arr = [...filteredTodos];
    arr.sort((a, b) => {
      const ao = a.sort_order ?? 1_000_000;
      const bo = b.sort_order ?? 1_000_000;
      if (ao !== bo) return ao - bo;
      return a.inserted_at < b.inserted_at ? -1 : 1;
    });
    return arr;
  }, [filteredTodos]);

  async function loadProject() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("No active workspace found.");
      router.push("/projects");
      return;
    }
    setWorkspaceRole(ws.role);

    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("id,name,description,status,owner_id,created_by,deadline,priority,project_type,phase,location_link")
      .eq("id", projectId)
      .single();

    if (projErr) {
      alert(projErr.message);
      router.push("/projects");
      return;
    }

    setProject(proj as Project);

    // Project membership role (for members collaboration)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    setProjectMemberRole((pm as any)?.role ?? null);
  }

  async function loadTodos() {
    // Prefer the view that calculates auto status based on hours (as you already do in Kanban) :contentReference[oaicite:5]{index=5}
    const { data, error } = await supabase
      .from("todo_status_auto")
      // IMPORTANT: requires view to include phase + sort_order, otherwise remove these fields from select/type
      .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,executed_minutes,auto_status,phase,sort_order")
      .eq("project_id", projectId);

    if (error) {
      console.error("Load todos failed:", error);
      setTodos([]);
      return;
    }

    setTodos(((data as any) ?? []) as TodoAuto[]);
  }

  async function loadTotals(pid: string) {
    const { data: plan, error: planErr } = await supabase
      .from("project_planned_totals")
      .select("planned_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (planErr) console.error("Load planned totals error:", planErr);
    setPlannedMinutes((plan as any)?.planned_minutes ?? 0);

    const { data: exec, error: execErr } = await supabase
      .from("project_executed_totals")
      .select("executed_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (execErr) console.error("Load executed totals error:", execErr);
    setExecutedMinutes((exec as any)?.executed_minutes ?? 0);
  }

  async function loadWorkspaceMembers() {
    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) return;

    const { data, error } = await supabase
      .from("workspace_members")
      .select("user_id, profiles:profiles(full_name,email)")
      .eq("workspace_id", ws.workspaceId);

    if (error) {
      console.error("Load members error:", error);
      setMembers([]);
      return;
    }

    setMembers(
      ((data as any[]) ?? []).map((r) => ({
        id: r.user_id,
        full_name: r.profiles?.full_name || r.user_id.slice(0, 8),
        email: r.profiles?.email ?? null,
      }))
    );
  }

  async function refreshAll() {
    await loadProject();
    await loadTodos();
    await loadWorkspaceMembers();
    if (projectId) await loadTotals(projectId);
  }

  useEffect(() => {
    (async () => {
      await loadProject();
      await loadTodos();
      await loadWorkspaceMembers();
      await loadTotals(projectId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Todos CRUD ----
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;
    if (!project) return;

    const clean = newTodoTitle.trim();
    if (!clean) return;

    // compute next sort_order client-side (safe enough for MVP)
    const current = todosRef.current.filter((t) => t.project_id === projectId);
    const maxSort = current.reduce((mx, t) => Math.max(mx, t.sort_order ?? 0), 0);

    const defaultPhase = project.project_type && project.project_type !== "standard" ? clampPhase(project.project_type, project.phase) : null;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
      estimated_minutes: null,
      sort_order: maxSort + 1,
      phase: defaultPhase,
    });

    if (error) return alert("No permission or error: " + error.message);

    setNewTodoTitle("");
    await refreshAll();
  }

  async function removeTodo(todoId: string) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").delete().eq("id", todoId);
    if (error) return alert("No permission or error: " + error.message);

    await refreshAll();
  }

  // ---- Todo field updates (estimate + assignee + phase) ----
  async function updateTodoEstimate(todoId: string, hoursText: string) {
    if (!canEditTodos) return;

    const minutes = hoursInputToMinutes(hoursText);
    const next = minutes === null ? null : minutes;

    const { error } = await supabase.from("todos").update({ estimated_minutes: next }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  async function updateTodoAssignee(todoId: string, nextUserId: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ assigned_to: nextUserId }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  async function updateTodoPhase(todoId: string, nextPhase: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ phase: nextPhase }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  // ---- Drag & drop reorder (persist sort_order) ----
  function onDragStart(todoId: string) {
    if (!canEditTodos) return;
    setDraggingId(todoId);
  }

  function onDragOver(todoId: string) {
    if (!canEditTodos) return;
    if (!draggingId || draggingId === todoId) return;
    setDragOverId(todoId);
  }

  async function onDrop(todoId: string) {
    if (!canEditTodos) return;
    const fromId = draggingId;
    const toId = todoId;
    setDragOverId(null);
    setDraggingId(null);

    if (!fromId || fromId === toId) return;

    const cur = sortedTodos; // already filtered + sorted list
    const fromIdx = cur.findIndex((t) => t.id === fromId);
    const toIdx = cur.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...cur];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Optimistic UI: update local sort_order
    const optimistic = next.map((t, idx) => ({ ...t, sort_order: idx + 1 }));
    setTodos((prev) => {
      // merge optimistic back into full list (including done tasks if hidden)
      const map = new Map(optimistic.map((t) => [t.id, t]));
      return prev.map((t) => map.get(t.id) ?? t);
    });

    // Persist: set sort_order for all items in the reordered list
    const payload = optimistic.map((t) => ({ id: t.id, sort_order: t.sort_order }));
    const { error } = await supabase.rpc("reorder_todos", {
      p_project_id: projectId,
      p_items: payload, // payload = [{ id, sort_order }, ...]
    });


    if (error) {
      console.error(error);
      alert(error.message);
      await refreshAll(); // revert to server truth
    }
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  const planned = plannedMinutes ?? 0;
  const executed = executedMinutes ?? 0;
  const percent = calcPct(executed, planned);

  const statusClass = `${badgeBase} ${badgeClassForStatus(project.status)}`;
  const prioClass = `${badgeBase} ${badgeClassForPriority(project.priority)}`;

  const canShowPhaseOnTodos = project.project_type && project.project_type !== "standard";

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">{project.name}</h1>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className={statusClass}>status: {project.status}</span>
            <span className={prioClass}>priority: {project.priority ?? "medium"}</span>
            {project.project_type ? <span className={metaBadgeClass()}>type: {project.project_type}</span> : null}
            {project.deadline ? <span className={metaBadgeClass()}>deadline: {project.deadline}</span> : null}
            {project.location_link ? <span className={metaBadgeClass()}>link</span> : null}
            <span className={metaBadgeClass()}>role: {workspaceRole}</span>
          </div>

          {project.description ? <p className="mt-3 text-sm text-gray-700">{project.description}</p> : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)} disabled={!canEditProject || isStakeholder}>
            Edit project
          </Button>
        </div>
      </header>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Progress</div>
            <div className="text-xs text-gray-500">
              Status of tasks is automatically calculated based on hours logged up to today.
            </div>
          </div>
          <div className="text-sm text-gray-700">
            {minutesToHoursText(executed)} / {minutesToHoursText(planned)}
          </div>
        </div>

        <div className="mt-3">
          {percent === null ? (
            <div className="text-sm text-gray-500">No estimate yet (planned = 0)</div>
          ) : (
            <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Tasks</div>
            <div className="text-xs text-gray-500">
              Drag & drop to change order. “Done” is based on logged hours (100%).
            </div>
          </div>

          <label className="text-sm flex items-center gap-2 select-none">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={hideDoneTasks}
              onChange={(e) => setHideDoneTasks(e.target.checked)}
            />
            Hide done tasks
          </label>
        </div>

        <form onSubmit={addTodo} className="mt-4 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder={canEditTodos ? "Add a task…" : "You don’t have permission to add tasks"}
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            disabled={!canEditTodos}
          />
          <Button type="submit" disabled={!canEditTodos}>
            Add
          </Button>
        </form>

        <div className="mt-4 grid gap-2">
          {sortedTodos.length === 0 ? (
            <div className="text-sm text-gray-500">No tasks</div>
          ) : (
            sortedTodos.map((t) => {
              const pctTodo = calcPct(t.executed_minutes ?? 0, t.estimated_minutes ?? 0);
              const isDragging = draggingId === t.id;
              const isOver = dragOverId === t.id;

              return (
                <div
                  key={t.id}
                  draggable={canEditTodos}
                  onDragStart={() => onDragStart(t.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    onDragOver(t.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(t.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  className={[
                    "rounded-md border bg-white p-3",
                    canEditTodos ? "cursor-move" : "cursor-default",
                    isDragging ? "opacity-60" : "",
                    isOver ? "ring-2 ring-blue-300" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{t.title}</div>

                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={metaBadgeClass()}>status: {t.auto_status}</span>
                        {t.estimated_minutes ? (
                          <span className={metaBadgeClass()}>
                            {minutesToHoursText(t.executed_minutes)} / {minutesToHoursText(t.estimated_minutes)}{" "}
                            {pctTodo === null ? "" : `(${pctTodo}%)`}
                          </span>
                        ) : (
                          <span className={metaBadgeClass()}>no estimate</span>
                        )}
                        {canShowPhaseOnTodos ? (
                          <span className={metaBadgeClass()}>
                            phase: {t.phase ?? "—"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {canEditTodos ? (
                      <Button variant="danger" className="text-xs px-2 py-1 shrink-0" onClick={() => removeTodo(t.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-gray-500">Estimate (hours)</label>
                      <input
                        className="border rounded-md px-2 py-1 text-sm"
                        defaultValue={minutesToHoursInput(t.estimated_minutes)}
                        placeholder="0"
                        inputMode="decimal"
                        disabled={!canEditTodos}
                        onBlur={(e) => updateTodoEstimate(t.id, e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-xs text-gray-500">Assignee</label>
                      <select
                        className="border rounded-md px-2 py-1 text-sm"
                        value={t.assigned_to ?? ""}
                        disabled={!canEditTodos}
                        onChange={(e) => updateTodoAssignee(t.id, e.target.value || null)}
                      >
                        <option value="">— Unassigned —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {canShowPhaseOnTodos ? (
                      <div className="grid gap-1">
                        <label className="text-xs text-gray-500">Phase</label>
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={t.phase ?? ""}
                          disabled={!canEditTodos}
                          onChange={(e) => updateTodoPhase(t.id, e.target.value || null)}
                        >
                          <option value="">— None —</option>
                          {PHASES[project.project_type as Exclude<ProjectType, "standard">].map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="hidden md:block" />
                    )}
                  </div>

                  {t.estimated_minutes && pctTodo !== null ? (
                    <div className="mt-3">
                      <ProgressBar
                        value={pctTodo}
                        label={`${minutesToHoursText(t.executed_minutes)} / ${minutesToHoursText(t.estimated_minutes)} (${pctTodo}%)`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}


```


## FILE: app\projects\new\page.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

const PHASES: Record<ProjectType, { value: string; label: string }[]> = {
  standard: [],
  pdca: [
    { value: "plan", label: "Plan" },
    { value: "do", label: "Do" },
    { value: "check", label: "Check" },
    { value: "act", label: "Act" },
  ],
  dmaic: [
    { value: "define", label: "Define" },
    { value: "measure", label: "Measure" },
    { value: "analyze", label: "Analyze" },
    { value: "improve", label: "Improve" },
    { value: "control", label: "Control" },
  ],
};

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

export default function ProjectNewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD or ""
  const [estimatedHours, setEstimatedHours] = useState<string>("");

  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState<string>("");
  const [locationLink, setLocationLink] = useState<string>("");

  const isStakeholder = useMemo(() => role === "stakeholder", [role]);

  useEffect(() => {
    async function init() {
      setLoading(true);

      const user = await requireUser(router);
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        alert("No active workspace found.");
        router.push("/projects");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      // Defaults per role:
      // stakeholder: proposal
      if (ws.role === "stakeholder") {
        setStatus("proposed");
      } else {
        setStatus("active");
      }

      setLoading(false);
    }

    init();
  }, [router]);

  // When project type changes: reset/validate phase
  useEffect(() => {
    if (projectType === "standard") {
      if (phase !== "") setPhase("");
      return;
    }
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (phase && !allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
    // MVP: stakeholder can only choose proposed (prevents stakeholder from creating "active")
    if (isStakeholder) {
      return [{ value: "proposed", label: "proposed" }];
    }
    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ];
  }, [isStakeholder]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Please enter a title.");
    if (!workspaceId || !userId) return alert("No workspace or user found.");

    const nextDeadline = deadline ? deadline : null;
    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours);
    const nextPhase = projectType === "standard" ? null : phase.trim() ? phase.trim() : null;
    const loc = locationLink.trim();

    // Stakeholder stays forced proposed
    const nextStatus: ProjectStatus = isStakeholder ? "proposed" : status;

    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      name: cleanName,
      description: description.trim() || null,
      status: nextStatus,
      created_by: userId,

      // The app uses owner_id (for members often equal to created_by)
      owner_id: isStakeholder ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { data, error } = await supabase.from("projects").insert(payload).select("id").single();

    setSaving(false);

    if (error) {
      console.error("Create project error:", error);
      alert(error.message);
      return;
    }

    // Navigate to project detail
    router.push(`/projects/${data.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isStakeholder ? "Propose project" : "New project"}
          </h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Title */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project title"
            autoFocus
            disabled={saving}
          />
        </div>

        {/* Description */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            disabled={saving}
          />
        </div>

        {/* Two-column block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Estimated hours */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 2"
              inputMode="decimal"
              disabled={saving}
            />
            <div className="text-xs text-gray-500">Leave empty if unknown.</div>
          </div>

          {/* Priority */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          {/* Status */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={saving || isStakeholder}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
            {isStakeholder ? (
              <div className="text-xs text-gray-500">Stakeholders can only create proposals.</div>
            ) : null}
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Project type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              disabled={saving}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>

          {/* Phase (only for pdca/dmaic) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select
              className="border rounded-md px-3 py-2"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              disabled={saving || projectType === "standard"}
            >
              <option value="">—</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              Only applicable for PDCA/DMAIC projects.
            </div>
          </div>
        </div>

        {/* Location link */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. https://... or a file path (later)"
            disabled={saving}
          />
          <div className="text-xs text-gray-500">
            MVP: free text. Later you can validate URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : isStakeholder ? "Submit proposal" : "Create"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/projects")}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}


```


## FILE: app\projects\page.tsx

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { statusBadgeClass, priorityBadgeClass, metaBadgeClass } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectStatus = "proposed" | "active" | "done" | "archived";
type ProjectType = "standard" | "pdca" | "dmaic";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;
  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null;
  priority: Priority | null;
  project_type: ProjectType | null;
};

type TotalsRow = { project_id: string; planned_minutes?: number | null; executed_minutes?: number | null };

type OwnerOption = { id: string; label: string };

function priorityRank(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return 4;
  if (v === "high") return 3;
  if (v === "medium") return 2;
  return 1;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}h`;
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return 0;
  return Math.min(100, Math.round((executed / planned) * 100));
}

export default function ProjectsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<Project[]>([]);
  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});

  const [owners, setOwners] = useState<OwnerOption[]>([]);

  // Filters
  const [filterOwner, setFilterOwner] = useState<string>("all"); // all | none | userId
  const [filterStatus, setFilterStatus] = useState<string>("open"); // open | all | proposed | active | done | archived
  const [sortMode, setSortMode] = useState<"newest" | "priority_desc">("newest");

  const loadSeq = useRef(0);

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
          setOwners([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setLoadError("No active workspace found for this user.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // 1) Load owners (workspace members) for the owner filter dropdown.
      const { data: members, error: memErr } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(full_name,email)")
        .eq("workspace_id", ws.workspaceId)
        .order("created_at", { ascending: true });

      if (seq !== loadSeq.current) return;

      if (memErr) {
        console.warn("Load workspace members failed:", memErr);
        setOwners([]);
      } else {
        const opts: OwnerOption[] = ((members as any[]) ?? []).map((m) => {
          const id = m.user_id as string;
          const full = m.profiles?.full_name as string | null | undefined;
          const email = m.profiles?.email as string | null | undefined;
          const label = (full && full.trim()) || email || id.slice(0, 8);
          return { id, label };
        });
        setOwners(opts);
      }

      // 2) Load projects
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .select("id,name,description,inserted_at,status,owner_id,created_by,deadline,priority,project_type")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (projErr) {
        setProjects([]);
        setPlannedByProject({});
        setExecutedByProject({});
        setLoadError(projErr.message);
        setLoading(false);
        return;
      }

      const list = ((proj as any) ?? []) as Project[];
      setProjects(list);

      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setPlannedByProject({});
        setExecutedByProject({});
        setLoading(false);
        return;
      }

      // 3) Load totals (planned + executed) via views
      const [{ data: plan, error: planErr }, { data: exec, error: execErr }] = await Promise.all([
        supabase.from("project_planned_totals").select("project_id, planned_minutes").in("project_id", ids),
        supabase.from("project_executed_totals").select("project_id, executed_minutes").in("project_id", ids),
      ]);

      if (seq !== loadSeq.current) return;

      if (planErr) console.warn("Load planned totals failed:", planErr);
      if (execErr) console.warn("Load executed totals failed:", execErr);

      const planMap: Record<string, number> = {};
      for (const r of ((plan as any) ?? []) as TotalsRow[]) planMap[r.project_id] = (r.planned_minutes ?? 0) as number;

      const execMap: Record<string, number> = {};
      for (const r of ((exec as any) ?? []) as TotalsRow[]) execMap[r.project_id] = (r.executed_minutes ?? 0) as number;

      setPlannedByProject(planMap);
      setExecutedByProject(execMap);

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Projects page load failed:", e);
      setProjects([]);
      setOwners([]);
      setPlannedByProject({});
      setExecutedByProject({});
      setLoadError(e?.message ?? "Failed to load workspace/projects.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [load]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const ownerOk =
        filterOwner === "all"
          ? true
          : filterOwner === "none"
            ? p.owner_id === null
            : p.owner_id === filterOwner;

      const statusOk =
  filterStatus === "all"
    ? true
    : filterStatus === "open"
      ? p.status === "proposed" || p.status === "active"
      : p.status === filterStatus;


      return ownerOk && statusOk;
    });
  }, [projects, filterOwner, filterStatus]);

  const sortedProjects = useMemo(() => {
    const arr = [...filteredProjects];

    if (sortMode === "priority_desc") {
      arr.sort((a, b) => {
        const d = priorityRank(b.priority) - priorityRank(a.priority);
        if (d !== 0) return d;
        // Tiebreaker: newest first
        return a.inserted_at < b.inserted_at ? 1 : -1;
      });
      return arr;
    }

    // Default: newest first (already from DB, but keep deterministic)
    arr.sort((a, b) => (a.inserted_at < b.inserted_at ? 1 : -1));
    return arr;
  }, [filteredProjects, sortMode]);

  const ownerLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of owners) m[o.id] = o.label;
    return m;
  }, [owners]);

  const isStakeholder = role === "stakeholder";

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Projects</h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>
          
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/projects/new")}>
            {isStakeholder ? "Propose project" : "New project"}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Owner</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Status</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="open">Open (proposed + active)</option>
              <option value="all">All</option>
              <option value="proposed">proposed</option>
              <option value="active">active</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div className="grid gap-1">
            <div className="text-xs text-gray-500">Sort</div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
            >
              <option value="newest">Newest</option>
              <option value="priority_desc">Priority (high → low)</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{sortedProjects.length}</span> of{" "}
          <span className="font-medium text-gray-700">{projects.length}</span> projects
        </div>
      </section>

      {/* Content states */}
      {loading ? (
        <div className="mt-8 text-gray-500">Loading…</div>
      ) : loadError ? (
        <div className="mt-8 text-gray-600">
          <div className="font-medium text-red-700">Could not load projects</div>
          <div className="mt-2 text-sm text-gray-600">{loadError}</div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="mt-8 text-gray-600">
          {projects.length === 0 ? "No projects found." : "No projects match the current filters."}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {sortedProjects.map((p) => {
            const executed = executedByProject[p.id] ?? 0;
            const planned = plannedByProject[p.id] ?? 0;
            const progress = calcPct(executed, planned);

            const ownerLabel =
              p.owner_id === null ? "—" : ownerLabelById[p.owner_id] ?? p.owner_id.slice(0, 8);

            return (
              <li
                key={p.id}
                className="border rounded-lg p-4 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>

                    {p.description ? (
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={statusBadgeClass(p.status)}>{p.status}</span>
                      <span className={priorityBadgeClass(p.priority)}>{p.priority ?? "medium"}</span>
                      {p.project_type ? (
                        <span className={metaBadgeClass()}>{p.project_type}</span>
                      ) : null}
                      <span className={metaBadgeClass()}>Owner: {ownerLabel}</span>
                      {p.deadline ? (
                        <span className={metaBadgeClass()}>Deadline: {p.deadline}</span>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={progress} />
                      <div className="mt-1 text-xs text-gray-500">
                        Planned: {minutesToHoursText(planned)} • Executed: {minutesToHoursText(executed)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="outline" onClick={() => router.push(`/projects/${p.id}`)}>
                      Open
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}


```


## FILE: app\today\page.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser } from "@/app/lib/appContext";

type TimeEntry = {
  id: string;
  project_id: string;
  entry_date: string;
  minutes: number;
  note: string | null;
  inserted_at: string;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [sumMinutes, setSumMinutes] = useState(0);

  const [entryHours, setEntryHours] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const day = useMemo(() => todayISO(), []);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("Geen workspace gevonden.");
      router.push("/projects");
      return;
    }

    // projects dropdown
    const { data: ps } = await supabase
      .from("projects")
      .select("id,name")
      .eq("workspace_id", ws.workspaceId)
      .order("inserted_at", { ascending: false });

    setProjects((ps as any[])?.map((p) => ({ id: p.id, name: p.name })) ?? []);
    if (!projectId && (ps as any[])?.[0]?.id) setProjectId((ps as any[])[0].id);

    // today's entries
    const { data: e, error } = await supabase
      .from("time_entries")
      .select("id,project_id,entry_date,minutes,note,inserted_at")
      .eq("workspace_id", ws.workspaceId)
      .eq("entry_date", day)
      .order("inserted_at", { ascending: false });

    if (error) {
      console.error(error);
      setEntries([]);
      setSumMinutes(0);
    } else {
      const list = (e as TimeEntry[]) ?? [];
      setEntries(list);
      setSumMinutes(list.reduce((acc, x) => acc + (x.minutes ?? 0), 0));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEntry() {
    const minutes = hoursTextToMinutes(entryHours);
    if (!minutes) return alert("Vul geldige uren in (bijv. 1.0).");
    if (!projectId) return alert("Kies een project.");

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) return alert("Geen workspace.");

    const user = await supabase.auth.getUser();
    const uid = user.data.user?.id;
    if (!uid) return alert("Niet ingelogd.");

    setSaving(true);

    const { error } = await supabase.from("time_entries").insert({
      workspace_id: ws.workspaceId,
      project_id: projectId,
      todo_id: null,
      user_id: uid,
      entry_date: day,
      minutes,
      note: entryNote.trim() || null,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setEntryHours("");
    setEntryNote("");
    load();
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vandaag</h1>
          <div className="text-sm text-gray-500">{day}</div>
          <div className="mt-2 text-sm">
            Totaal vandaag: <span className="font-medium">{minutesToHoursText(sumMinutes)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projecten
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <>
          <section className="mt-6 border rounded-lg p-4">
            <h2 className="font-medium">Snel loggen</h2>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Project</label>
                <select
                  className="border rounded-md px-3 py-2"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={saving}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Uren</label>
                <input
                  className="border rounded-md px-3 py-2"
                  value={entryHours}
                  onChange={(e) => setEntryHours(e.target.value)}
                  placeholder="bijv. 0.5"
                  inputMode="decimal"
                  disabled={saving}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Actie</label>
                <Button onClick={addEntry} disabled={saving}>
                  {saving ? "Opslaan…" : "Log tijd"}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-1">
              <label className="text-sm font-medium">Notitie</label>
              <input
                className="border rounded-md px-3 py-2"
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                placeholder="optioneel"
                disabled={saving}
              />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-medium">Registraties vandaag</h2>
            {entries.length === 0 ? (
              <div className="mt-2 text-sm text-gray-600">Nog niets gelogd vandaag.</div>
            ) : (
              <ul className="mt-3 grid gap-2">
                {entries.map((e) => (
                  <li key={e.id} className="border rounded-md p-3">
                    <div className="text-sm">
                      <span className="font-medium">{minutesToHoursText(e.minutes)}</span>
                      {e.note ? <span className="text-gray-600"> • {e.note}</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(e.inserted_at).toLocaleString()} • Project: {e.project_id}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}


```

