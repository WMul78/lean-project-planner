

## FILE: app\account\page.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { requireUser } from "@/app/lib/appContext";

export default function AccountPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await requireUser(router);
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) console.error(error);

      setFullName((data as any)?.full_name ?? "");
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;

    if (!uid) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", uid);

    setSaving(false);

    if (error) return alert(error.message);
    alert("Naam opgeslagen!");
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Projecten
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <>
          <div className="mt-6">
            <label className="text-sm text-gray-600">Naam</label>
            <input
              className="mt-2 w-full border rounded-md px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Bijv. Jan Jansen"
            />
            <div className="mt-2 text-xs text-gray-400">
              Deze naam wordt gebruikt bij het toewijzen van taken.
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={save} disabled={saving}>
              {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </>
      )}
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
          <span className="hidden sm:inline">Acties</span>
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
          type="button"
        >
          {showManage ? "Sluiten" : "Beheer"}
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
  is_done: boolean; // 👈 nieuw
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
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Ma–Vr

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key=todo|date

  const [savingKey, setSavingKey] = useState<string | null>(null);

  // ✅ FIX: expliciete typing (lost “untracked”/index errors op)
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
    if (!user) {
      // requireUser kan al redirecten, maar we zetten loading alsnog uit
      return;
    }
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("Geen workspace gevonden.");
      router.push("/projects");
      return;
    }
    setWorkspaceId(ws.workspaceId);

    // 1) mijn taken (assigned_to = ik)
    const { data: td, error: tdErr } = await supabase
    .from("todos")
    .select("id,project_id,title,assigned_to,estimated_minutes,is_done,projects(name)")
    .eq("assigned_to", user.id)
    .eq("is_done", false) // 👈 alleen open taken
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

    const todoList = (td as any as TodoRow[]) ?? [];
    setTodos(todoList);

    const ids = todoList.map((t) => t.id);
    if (ids.length === 0) {
      setCells({});
      setExecutedByTodo({});
      return;
    }

    // 2) entries in deze week (voor mij)
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
      for (const en of (entries as any as EntryCell[]) ?? []) {
        map[cellKey(en.todo_id, en.entry_date)] = en;
      }
      setCells(map);
    }

    // 3) executed totals per todo (<= today) via view
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

    // leeg => delete (als er iets bestond)
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

    // upsert (vereist unique index op todo_id, entry_date, user_id)
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId,   // MVP: dit is jouw eigen planner (later: assignee)
      logged_by: userId, // later: owner kan voor anderen plannen
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
    const exec = executedByTodo[todo.id] ?? 0; // ✅ geen TS error meer
    return Math.min(100, Math.round((exec / planned) * 100));
  }

  function nextWeek() {
    setWeekStart(addDays(weekStart, 7));
  }

  function prevWeek() {
    setWeekStart(addDays(weekStart, -7));
  }

 // ... alle useState/useEffect ...

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
      <div className="text-gray-500">Laden…</div>
    </main>
  );
}


  return (
  <main className="p-6 max-w-7xl mx-auto">
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Uren plannen (week)</h1>
        <div className="text-sm text-gray-500">
          Alleen jouw taken. Uren in de toekomst tellen niet mee voor voortgang.
        </div>
      </div>

      <div className="flex flex-col gap-2 items-end">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Projecten
        </Button>
      </div>
    </header>

    <div className="mt-4 flex items-center justify-between">
      <div className="flex gap-2">
        <Button variant="outline" onClick={prevWeek}>
          ← Vorige
        </Button>
        <Button variant="outline" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
          Vandaag
        </Button>
        <Button variant="outline" onClick={nextWeek}>
          Volgende →
        </Button>
      </div>

      <div className="text-sm text-gray-600">
        Week van <span className="font-medium">{iso(days[0])}</span>
      </div>
    </div>

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
        Geen taken aan jou toegewezen.
        <div className="text-sm text-gray-500 mt-1">
          Wijs taken toe via <code>assigned_to</code> om ze hier te plannen.
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
                  <th className="border p-2 sticky left-0 bg-white z-10">Taak</th>

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

                  <th className="border p-2">Voortgang</th>
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
                              Benodigd: {minutesToHoursInput(t.estimated_minutes) || "—"}u
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
                                  uitgevoerd: {minutesToHoursText(exec)}
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
                  <td className="border p-2 font-semibold sticky left-0 bg-white z-10">Totaal</td>
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

        {/* MOBILE: single-day table */}
        <div className="mt-6 md:hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: 220 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
              </colgroup>

              <thead>
                <tr className="text-left">
                  <th className="border p-2">Taak</th>
                  <th className="border p-2">
                    {mobileDay
                      ? mobileDay.toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : ""}
                  </th>
                  <th className="border p-2">Voortgang</th>
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
                              Benodigd: {minutesToHoursInput(t.estimated_minutes) || "—"}u
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
                                  uitgevoerd: {minutesToHoursText(exec)}
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
                  <td className="border p-2 font-semibold">Totaal</td>
                  <td className="border p-2 font-semibold">
                    {minutesToHoursText(dayTotalMinutes(mobileDayISO))}
                  </td>
                  <td className="border p-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Tip: wijzig een cel en klik buiten het veld (onBlur) om op te slaan.
        </div>
      </>
    )}
  </main>
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
  auto_status: "proposed" | "active" | "done"; // uit view
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
  return `${h}u`;
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

  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "none" | string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag & drop (projects only)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

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
          setTodos([]);
          setPlannedByProject({});
          setExecutedByProject({});
          setOwners([]);
          setLoadError("Geen workspace gevonden.");
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

      const projectList = (pr as any as ProjectRow[]) ?? [];
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
      for (const r of (plan as any as TotalsRowPlanned[]) ?? []) planMap[r.project_id] = r.planned_minutes ?? 0;
      setPlannedByProject(planMap);

      const execMap: Record<string, number> = {};
      for (const r of (exec as any as TotalsRowExecuted[]) ?? []) execMap[r.project_id] = r.executed_minutes ?? 0;
      setExecutedByProject(execMap);

      // 4) Todos via view todo_status_auto (geen workspace_id -> in(project_id))
      // MVP: we tonen geen done taken in kanban
      const { data: td, error: tdErr } = await supabase
        .from("todo_status_auto")
        .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,is_done,executed_minutes,auto_status")
        .in("project_id", ids)
        .neq("auto_status", "done")
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
      setLoadError(e?.message ?? "Fout bij laden.");
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

  // ---- Tasks follow project filters (owner/prio), but get own column status ----
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

    // sort tasks by project priority (hoog -> laag), then by newest
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
        draggable
        style={{ cursor: "grab" }}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          requestAnimationFrame(() => setDraggingId(p.id)); // important: stable DnD
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverStatus(null);
        }}
        className={[
          "rounded-lg border bg-white p-3 shadow-sm hover:shadow transition-shadow",
          "w-full max-w-full overflow-hidden",
          draggingId === p.id ? "opacity-60 ring-2 ring-blue-400" : "",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            {!compact && p.description ? (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
            ) : null}
          </div>

          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => router.push(`/projects/${p.id}`)}
          >
            Open
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className={statusBadgeClass(p.status)}>{p.status}</span>
          <span className={priorityBadgeClass(p.priority)}>prio: {p.priority ?? "medium"}</span>
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
              <ProgressBar
                value={percent}
                label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`}
              />
            ) : (
              <div className="text-sm text-gray-500">Geen raming (planned = 0)</div>
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
              <span className={priorityBadgeClass(prio)}>prio: {prio}</span>
              {planned > 0 ? (
                <span className={metaBadgeClass()}>
                  {minutesToHoursText(executed)} / {minutesToHoursText(planned)} ({percent}%)
                </span>
              ) : (
                <span className={metaBadgeClass()}>geen raming</span>
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
            <ProgressBar
              value={percent}
              label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`}
            />
          </div>
        ) : null}

        <div className="mt-2 text-[11px] text-gray-500">
          Status is automatisch op basis van voortgang: 0% proposed, 1–99% active, 100% done.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projecten • Kanban</h1>
          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>
          <div className="text-sm text-gray-500">Rol: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Lijst
          </Button>
          <Button onClick={() => router.push("/projects/new")}>
            {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
          </Button>
        </div>
      </header>

      <section className="mt-5 border rounded-lg p-4">
        <div className="font-medium">Filters</div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs text-gray-500">Prioriteit</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
            >
              <option value="all">Alle</option>
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
              <option value="all">Alle</option>
              <option value="none">— geen owner —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Weergave</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="projects">Projecten</option>
              <option value="todos">Taken</option>
              <option value="both">Beide</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Sortering</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Prioriteit (hoog → laag)</option>
              <option value="newest">Nieuwste eerst</option>
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
                  dragOverStatus === col.key ? "ring-2 ring-blue-400 bg-blue-50/30" : "",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStatus(col.key);
                }}
                onDragLeave={() => setDragOverStatus((s) => (s === col.key ? null : s))}
                onDrop={async (e) => {
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
                    {projectsByColumn[col.key].length} proj • {todosByColumn[col.key].length} taken
                  </div>
                </div>

                <div className="p-3 grid gap-3">
                  {/* Projects */}
                  {(viewMode === "projects" || viewMode === "both") ? (
                    projectsByColumn[col.key].length === 0 ? (
                      <div className="text-sm text-gray-500">Geen projecten</div>
                    ) : (
                      projectsByColumn[col.key].map((p) => <ProjectCard key={p.id} p={p} compact={false} />)
                    )
                  ) : null}

                  {/* Tasks */}
                  {(viewMode === "todos" || viewMode === "both") ? (
                    todosByColumn[col.key].length === 0 ? (
                      <div className="text-sm text-gray-500">Geen taken</div>
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
          Takenstatus wordt automatisch bepaald op basis van voortgang (uren t/m vandaag).
        </div>
      </section>
    </main>
  );
}


```


## FILE: app\layout.tsx

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";



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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
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
    const { error } = await supabase.auth.signUp({ email, password });
    setIsLoading(false);

    if (error) return alert(error.message);
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
type ProjectStatus = "proposed" | "active" | "done" | "archived"; // later evt. "on_hold"

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // date in ISO (YYYY-MM-DD)
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
  const hours = Math.round((min / 60) * 10) / 10; // 1 decimaal
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

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD of ""
  const [estimatedHours, setEstimatedHours] = useState<string>(""); // UI in uren
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

    // stakeholder: edit alleen eigen proposal (MVP: alleen als proposed + created_by=self)
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

    // Project membership role (voor member samenwerking)
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

  // Wanneer type verandert: phase valideren/resetten
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
    if (!canEdit) return alert("Je hebt geen rechten om dit project te bewerken.");
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Vul een titel in.");

    // eenvoudige validatie locatie link
    const loc = locationLink.trim();
    if (loc && loc.length > 500) return alert("Locatie link is te lang.");

    // phase: als standard => null
    const nextPhase =
      projectType === "standard" ? null : (phase.trim() ? phase.trim() : null);

    // deadline: "" => null
    const nextDeadline = deadline ? deadline : null;

    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours); // null als leeg/invalid

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
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Project niet gevonden.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Terug
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push(`/projects/${project.id}`)}>
          ← Terug
        </Button>

        <div className="text-sm text-gray-500">
          Workspace rol: {workspaceRole} {projectMemberRole ? `• Project rol: ${projectMemberRole}` : ""}
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Project bewerken</h1>
      <div className="mt-1 text-sm text-gray-500">
        {project.name} {!canEdit ? "• Alleen-lezen" : null}
      </div>

      {!canEdit ? (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50 text-sm text-gray-700">
          Je hebt geen rechten om dit project te wijzigen.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Titel */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Titel</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="Project titel"
            autoFocus
          />
        </div>

        {/* Omschrijving */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Omschrijving</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="Korte omschrijving (optioneel)"
          />
        </div>

        {/* 2 koloms blok */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>

          {/* Tijd benodigd (uren) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Tijd benodigd (uren)</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="bijv. 2 of 1.5"
              inputMode="decimal"
            />
            <div className="text-xs text-gray-500">Wordt opgeslagen als minuten (estimated_minutes).</div>
          </div>

          {/* Prioriteit */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Prioriteit</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={!canEdit || saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very high</option>
            </select>
          </div>

          {/* Status */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={!canEdit || saving}
            >
              <option value="proposed">proposed</option>
              <option value="active">active</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
            <div className="text-xs text-gray-500">
              Later kun je “on_hold” toevoegen als je die status wilt ondersteunen.
            </div>
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              disabled={!canEdit || saving}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>

          {/* Fase */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Fase</label>

            {projectType === "standard" ? (
              <input
                className="border rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                value="—"
                disabled
              />
            ) : (
              <select
                className="border rounded-md px-3 py-2"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                disabled={!canEdit || saving}
              >
                <option value="">— kies fase —</option>
                {PHASES[projectType].map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Locatie */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Locatie (link)</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="bijv. https://... of filepad (later)"
          />
          <div className="text-xs text-gray-500">
            MVP: vrije tekst. Later kun je validatie doen op URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={!canEdit || saving}>
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push(`/projects/${project.id}`)}
            disabled={saving}
          >
            Annuleren
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

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, badgeClassForStatus, badgeClassForPriority, metaBadgeClass } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

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

type Todo = {
  id: string;
  title: string;
  is_done: boolean;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
};

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
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
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return null;
  return Math.min(100, Math.round((executed / planned) * 100));
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // ✅ Stap 6 totals
  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // ✅ Workspace members voor assignee dropdown
  const [members, setMembers] = useState<{ id: string; full_name: string; email?: string | null }[]>([]);
  const [executedByTodo, setExecutedByTodo] = useState<Record<string, number>>({});

  const canEditProject = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: alleen eigen proposal (MVP)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  const canEditTodos = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

  


    // stakeholder: geen todo edits
    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  const progressPct = useMemo(
    () => calcPct(executedMinutes, plannedMinutes),
    [executedMinutes, plannedMinutes]
  );

  const memberNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of members) {
    m[x.id] = x.full_name || x.email || x.id.slice(0, 8);
    }
    return m;
  } , [members]);

  async function loadProject() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

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

    setProject(proj as any);

    // membership role (voor samenwerking)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    setProjectMemberRole((pm as any)?.role ?? null);
  }

  async function loadTodos() {
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at,assigned_to,estimated_minutes")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (tdErr) {
      alert(tdErr.message);
      setTodos([]);
      return;
    }
    const list = ((td as any) ?? []) as Todo[];
      setTodos(list);
      await loadTodoExecutedTotals(list.map((x) => x.id));

    }

async function loadTodoExecutedTotals(todoIds: string[]) {
  if (todoIds.length === 0) {
    setExecutedByTodo({});
    return;
  }

  const { data, error } = await supabase
    .from("todo_executed_totals")
    .select("todo_id, executed_minutes")
    .in("todo_id", todoIds);

  if (error) {
    console.error("Load todo executed totals error:", error);
    setExecutedByTodo({});
    return;
  }

  const m: Record<string, number> = {};
  for (const r of (data as any[]) ?? []) {
    m[r.todo_id] = r.executed_minutes ?? 0;
  }
  setExecutedByTodo(m);
}



  async function loadTotals(pid: string) {
    // planned = sum todos.estimated_minutes
    const { data: plan, error: planErr } = await supabase
      .from("project_planned_totals")
      .select("planned_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (planErr) console.error("Load planned totals error:", planErr);
    setPlannedMinutes((plan as any)?.planned_minutes ?? 0);

    // executed = sum time_entries.minutes where entry_date <= today
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
    // init
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

    const clean = newTodoTitle.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
      estimated_minutes: null,
    });

    if (error) return alert("Geen rechten of fout: " + error.message);

    setNewTodoTitle("");
    await refreshAll();
  }

  async function toggleDone(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ is_done: !todo.is_done }).eq("id", todo.id);
    if (error) return alert("Geen rechten of fout: " + error.message);

    await refreshAll();
  }

  async function removeTodo(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) return alert("Geen rechten of fout: " + error.message);

    await refreshAll();
  }

  // ---- Todo fields updates (estimate + assignee) ----
  async function updateTodoEstimate(todoId: string, hoursText: string) {
    if (!canEditTodos) return;

    const minutes = hoursInputToMinutes(hoursText);
    const next = minutes === null ? null : minutes;

    const { error } = await supabase
      .from("todos")
      .update({ estimated_minutes: next })
      .eq("id", todoId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await refreshAll(); // planned totals updaten
  }

  async function updateTodoAssignee(todoId: string, nextUserId: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase
      .from("todos")
      .update({ assigned_to: nextUserId })
      .eq("id", todoId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await refreshAll();
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/hours")}>
            Uren plannen →
          </Button>
          <Button variant="outline" onClick={refreshAll}>
            Verversen
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{project?.name ?? "Project"}</h1>
          {project?.description ? <p className="text-gray-600 mt-1">{project.description}</p> : null}

          {project ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`${badgeBase} ${badgeClassForStatus(project.status)}`}>
                {project.status}
              </span>

              <span className={`${badgeBase} ${badgeClassForPriority(project.priority)}`}>
                prio: {project.priority ?? "medium"}
              </span>


              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                type: {project.project_type ?? "standard"}
              </span>

              {project.deadline ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  deadline: {project.deadline}
                </span>
              ) : null}

              {project.phase ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  fase: {project.phase}
                </span>
              ) : null}

              {!canEditProject ? <span className="text-sm text-gray-500">Alleen-lezen</span> : null}
            </div>
          ) : null}

          {project?.location_link ? (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Locatie:</span>{" "}
              <a className="text-blue-600 underline break-all" href={project.location_link} target="_blank" rel="noreferrer">
                {project.location_link}
              </a>
            </div>
          ) : null}
        </div>

        {canEditProject ? (
          <div className="shrink-0">
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              Project bewerken
            </Button>
          </div>
        ) : null}
      </div>

      {/* ✅ Voortgang (stap 6) */}
      <section className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold">Voortgang</h2>

        {plannedMinutes > 0 ? (
          <div className="mt-3">
            <ProgressBar
              value={progressPct ?? 0}
              label={`${minutesToHoursText(executedMinutes)} / ${minutesToHoursText(plannedMinutes)} (${progressPct ?? 0}%)`}
            />
            <div className="mt-2 text-xs text-gray-500">
              Uitgevoerd telt alleen uren met datum t/m vandaag. Uren in de toekomst zijn alleen planning.
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Nog geen taak-ramingen ingevuld (planned = 0). Vul per taak de benodigde tijd in.
          </div>
        )}
      </section>

      {/* Taken */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Taken</h2>
          <div className="text-sm text-gray-500">
            Workspace rol: {workspaceRole} {projectMemberRole ? `• Project rol: ${projectMemberRole}` : ""}
          </div>
        </div>

        {canEditTodos ? (
          <form onSubmit={addTodo} className="flex gap-2 mt-3">
            <input
              className="flex-1 border rounded-md px-3 py-2"
              placeholder="Nieuwe taak..."
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
            />
            <Button type="submit">Toevoegen</Button>
          </form>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Je kunt taken niet aanpassen in dit project (geen edit-rechten).
          </div>
        )}

        <ul className="mt-4 grid gap-2">
          {todos.map((t) => (
            <li key={t.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start gap-3">
                <label className="flex gap-3 items-center flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.is_done}
                    onChange={() => toggleDone(t)}
                    disabled={!canEditTodos}
                  />
                  <div className="min-w-0">
                    <div className={`font-medium ${t.is_done ? "line-through text-gray-500" : ""}`}>
                         {t.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      Benodigd: {t.estimated_minutes ? minutesToHoursText(t.estimated_minutes) : "—"} •{" "}
                      Toegewezen:{" "}
                        {t.assigned_to ? (memberNameById[t.assigned_to] ?? t.assigned_to.slice(0, 8)) : "—"}
                    </div>
                  </div>
                </label>
{t.estimated_minutes && t.estimated_minutes > 0 ? (() => {
  const exec = executedByTodo[t.id] ?? 0;
  const planned = t.estimated_minutes ?? 0;
  const percent = Math.min(100, Math.round((exec / planned) * 100));

  return (
    <div className="mt-2">
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className="h-2 bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-gray-500">
        {percent}% • {minutesToHoursText(exec)} / {minutesToHoursText(planned)}
      </div>
    </div>
  );
})() : (
  <div className="mt-2 text-[11px] text-gray-400">Geen raming</div>
)}


                {canEditTodos ? (
                  <Button variant="danger" onClick={() => removeTodo(t)}>
                    Verwijder
                  </Button>
                ) : null}
              </div>

              {/* ✅ Edit velden: estimate + assignee */}
              <div className="mt-2 flex flex-wrap items-end gap-3">
  {/* Benodigd uren: compact */}
  <div className="flex flex-col">
    <label className="text-[11px] text-gray-500 leading-none">Benodigd (u)</label>
    <input
      className="mt-1 w-[110px] border rounded-md px-2 py-1 text-sm"
      defaultValue={minutesToHoursInput(t.estimated_minutes)}
      placeholder="bijv. 2"
      inputMode="decimal"
      disabled={!canEditTodos}
      onBlur={(e) => updateTodoEstimate(t.id, e.target.value)}
    />
  </div>

  {/* Assignee: compact */}
  <div className="flex flex-col min-w-[160px]">
    <label className="text-[11px] text-gray-500 leading-none">Toegewezen</label>
    <select
      className="mt-1 border rounded-md px-2 py-1 text-sm"
      value={t.assigned_to ?? ""}
      disabled={!canEditTodos}
      onChange={(e) => updateTodoAssignee(t.id, e.target.value || null)}
    >
      <option value="">— niemand —</option>
      {userId ? <option value={userId}>Ik</option> : null}
      {members
        .filter((m) => m.id !== userId)
        .map((m) => (
          <option key={m.id} value={m.id}>
          {m.full_name || m.email || m.id.slice(0, 8)}
          </option>

        ))}
    </select>
  </div>

  {/* optioneel: klein hintje rechts */}
  <div className="text-[11px] text-gray-400 leading-snug pb-1">
    (later: naam/email)
  </div>
</div>

              
            </li>
          ))}
        </ul>
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

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD of ""
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
        alert("Geen actieve workspace gevonden.");
        router.push("/projects");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      // Defaults per rol:
      // stakeholder: voorstel
      if (ws.role === "stakeholder") {
        setStatus("proposed");
      } else {
        setStatus("active");
      }

      setLoading(false);
    }

    init();
  }, [router]);

  // Wanneer type verandert: phase reset/valideren
  useEffect(() => {
    if (projectType === "standard") {
      if (phase !== "") setPhase("");
      return;
    }
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (phase && !allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] =
    useMemo(() => {
      // MVP: stakeholder mag alleen proposed kiezen (voorkomt dat stakeholder "active" aanmaakt)
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
    if (!cleanName) return alert("Vul een titel in.");
    if (!workspaceId || !userId) return alert("Geen workspace of gebruiker gevonden.");

    const nextDeadline = deadline ? deadline : null;
    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours);
    const nextPhase =
      projectType === "standard" ? null : (phase.trim() ? phase.trim() : null);
    const loc = locationLink.trim();

    // Stakeholder blijft forced proposed
    const nextStatus: ProjectStatus = isStakeholder ? "proposed" : status;

    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      name: cleanName,
      description: description.trim() || null,
      status: nextStatus,
      created_by: userId,

      // jouw bestaande app gebruikt owner_id (voor members vaak gelijk aan created_by)
      owner_id: isStakeholder ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      console.error("Create project error:", error);
      alert(error.message);
      return;
    }

    // navigeer naar project detail
    router.push(`/projects/${data.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isStakeholder ? "Project voorstellen" : "Nieuw project"}
          </h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Rol: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Terug
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Titel */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Titel</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project titel"
            autoFocus
            disabled={saving}
          />
        </div>

        {/* Omschrijving */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Omschrijving</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Korte omschrijving (optioneel)"
            disabled={saving}
          />
        </div>

        {/* 2 koloms blok */}
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

          {/* Tijd benodigd (uren) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Tijd benodigd (uren)</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="bijv. 2 of 1.5"
              inputMode="decimal"
              disabled={saving}
            />
            <div className="text-xs text-gray-500">
              Wordt opgeslagen als minuten (estimated_minutes).
            </div>
          </div>

          {/* Prioriteit */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Prioriteit</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very high</option>
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
              <div className="text-xs text-gray-500">
                Stakeholders maken een voorstel aan (status = proposed).
              </div>
            ) : null}
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
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

          {/* Fase */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Fase</label>

            {projectType === "standard" ? (
              <input
                className="border rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                value="—"
                disabled
              />
            ) : (
              <select
                className="border rounded-md px-3 py-2"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                disabled={saving}
              >
                <option value="">— kies fase —</option>
                {PHASES[projectType].map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Locatie */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Locatie (link)</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="bijv. https://... of filepad (later)"
            disabled={saving}
          />
          <div className="text-xs text-gray-500">
            MVP: vrije tekst. Later kun je validatie doen op URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Aanmaken…" : isStakeholder ? "Voorstel indienen" : "Aanmaken"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/projects")}
            disabled={saving}
          >
            Annuleren
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
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import ActionsMenu from "@/app/components/ActionsMenu";
import { badgeBase, badgeClassForStatus, badgeClassForPriority } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // YYYY-MM-DD
  priority: Priority | null;
  project_type: ProjectType | null;
};



function labelProjectType(t: ProjectType | null | undefined) {
  return t ?? "standard";
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

export default function ProjectsPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const [projects, setProjects] = useState<Project[]>([]);

  // ✅ nieuw: executed vs planned maps
  const [executedByProject, setExecutedByProject] = useState<Record<string, number>>({});
  const [plannedByProject, setPlannedByProject] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // race condition guard
  const loadSeq = useRef(0);

  const canManageUsers = useMemo(() => role === "owner" || role === "admin", [role]);

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
          setExecutedByProject({});
          setPlannedByProject({});
          setLoadError("Geen workspace gevonden voor deze gebruiker.");
          setLoading(false);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setWorkspaceId(ws.workspaceId);
        setRole(ws.role);
      }

      // ✅ Projects laden
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,description,inserted_at,status,owner_id,created_by,deadline,priority,project_type")
        .eq("workspace_id", ws.workspaceId)
        .order("inserted_at", { ascending: false });

      if (seq !== loadSeq.current) return;

      if (error) {
        console.error("Load projects error:", error);
        setProjects([]);
        setExecutedByProject({});
        setPlannedByProject({});
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      const list = (data as Project[]) ?? [];
      setProjects(list);

      const ids = list.map((p) => p.id);
      if (ids.length === 0) {
        setExecutedByProject({});
        setPlannedByProject({});
        setLoading(false);
        return;
      }

      // ✅ Executed totals (alleen t/m vandaag) per project
      const { data: exec, error: execErr } = await supabase
        .from("project_executed_totals")
        .select("project_id, executed_minutes")
        .in("project_id", ids);

      if (execErr) console.error("Load executed totals error:", execErr);

      // ✅ Planned totals (som todos.estimated_minutes) per project
      const { data: plan, error: planErr } = await supabase
        .from("project_planned_totals")
        .select("project_id, planned_minutes")
        .in("project_id", ids);

      if (planErr) console.error("Load planned totals error:", planErr);

      if (seq !== loadSeq.current) return;

      const executedMap: Record<string, number> = {};
      for (const row of (exec as any[]) ?? []) {
        executedMap[row.project_id] = row.executed_minutes ?? 0;
      }

      const plannedMap: Record<string, number> = {};
      for (const row of (plan as any[]) ?? []) {
        plannedMap[row.project_id] = row.planned_minutes ?? 0;
      }

      setExecutedByProject(executedMap);
      setPlannedByProject(plannedMap);

      setLoading(false);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      console.error("Projects page load failed:", e);
      setProjects([]);
      setExecutedByProject({});
      setPlannedByProject({});
      setLoadError(e?.message ?? "Fout bij laden van workspace/projecten.");
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

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
   <main className="p-6 max-w-3xl mx-auto">
  <header className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold">Projecten</h1>

      <div className="mt-2">
        <WorkspaceSwitcher />
      </div>

      <div className="text-sm text-gray-500">Rol: {role}</div>

        
    </div>

    {/* Rechterkant: primaire actie + menu */}
    <div className="flex items-center gap-2">
      {/* Primaire actie */}
      <Button onClick={() => router.push("/projects/new")}>
        {role === "stakeholder" ? "Project voorstellen" : "Nieuw project"}
      </Button>

      {/* Acties menu */}
      <ActionsMenu
        icon="dots"
        items={[
          {
            label: "Uren plannen",
            onClick: () => router.push("/hours"),
          },
          {
            label: "Kanban",
            onClick: () => router.push("/kanban"),
          },
          {
            label: "Account",
            onClick: () => router.push("/account"),
          },
          {
            label: "Gebruikers beheren",
            onClick: () => router.push("/admin/users"),
            disabled: role !== "owner" && role !== "admin",
          },
          {
            label: "Uitloggen",
            onClick: signOut,
            danger: true,
          },
        ]}
      />
    </div>
  </header>


      {loading ? (
        <div className="mt-8 text-gray-500">Laden...</div>
      ) : loadError ? (
        <div className="mt-8 text-gray-600">
          <div className="font-medium text-red-700">Kon projecten niet laden</div>
          <div className="mt-2 text-sm text-gray-600">{loadError}</div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={load}>
              Opnieuw laden
            </Button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-8 text-gray-600">Geen projecten gevonden.</div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {projects.map((p) => {
            const executed = executedByProject[p.id] ?? 0;
            const planned = plannedByProject[p.id] ?? 0;
            const progress = planned > 0 ? Math.min(100, Math.round((executed / planned) * 100)) : null;

            return (
              <li key={p.id} className="border rounded-lg p-4 flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.name}</div>

                    <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForStatus(p.status)}`}>
                      {p.status}
                    </span>

                    <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClassForPriority(p.priority ?? "medium")}`}>
                      prio: {p.priority ?? "medium"}
                    </span>

                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      type: {labelProjectType(p.project_type)}
                    </span>

                    {p.deadline ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        deadline: {p.deadline}
                      </span>
                    ) : null}
                  </div>

                  {p.description ? (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</div>
                  ) : null}

                  {/* ✅ Progress gebaseerd op tasks + executed (<= vandaag) */}
                  {planned > 0 ? (
                    <div className="mt-3">
                      <ProgressBar
                        value={progress ?? 0}
                        label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${progress ?? 0}%)`}
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Uitgevoerd telt alleen t/m vandaag. Toekomstige planning telt niet mee.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">Geen taak-ramingen ingevuld (planned = 0).</div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col gap-2 items-end">
                  <Button onClick={() => router.push(`/projects/${p.id}`)}>Open</Button>
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

