

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
          Role: {role} {workspaceId ? `…` : ""}
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


## FILE: app\api\billing\checkout\route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Plan = "core" | "pro";

function pickPlan(v: any): Plan {
  return v === "core" ? "core" : "pro";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  // New env vars (set these in Vercel + local)
  const variantCore = process.env.LEMONSQUEEZY_VARIANT_ID_CORE;
  const variantPro = process.env.LEMONSQUEEZY_VARIANT_ID_PRO;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !storeId || !variantCore || !variantPro || !appUrl) {
    return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = pickPlan(body?.plan);

  const variantId = plan === "core" ? variantCore : variantPro;

  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) console.error("supabase.auth.getUser error:", userErr);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Read active workspace from profile (auth user context)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    console.error("profiles select error:", profErr);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  const workspaceId = profile?.active_workspace_id as string | null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace selected" }, { status: 400 });
  }

  // Optional (recommended): ensure the user is actually a member of that workspace
  const { data: wm, error: wmErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (wmErr) console.error("workspace_members check error:", wmErr);
  if (!wm) return NextResponse.json({ error: "Not a member of active workspace" }, { status: 403 });

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${appUrl}/settings/billing?success=1&plan=${plan}`,
        },
        checkout_data: {
          email: user.email,
          // IMPORTANT: include workspace_id so webhook can attach subscription to workspace
          custom: { user_id: user.id, workspace_id: workspaceId, plan },
        },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Lemon checkout create failed:", res.status, text);
    return NextResponse.json(
      { error: "Checkout create failed", lemonStatus: res.status, details: text },
      { status: 500 }
    );
  }

  const json = await res.json();
  return NextResponse.json({ url: json?.data?.attributes?.url }, { status: 200 });
}


```


## FILE: app\api\webhooks\lemonsqueezy\route.ts

```ts
// app/api/webhooks/lemonsqueezy/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function verifySignature(rawBody: string, signatureHex: string, secret: string) {
  const signature = Buffer.from(signatureHex ?? "", "hex");
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const hmac = Buffer.from(digest, "hex");
  if (signature.length !== hmac.length) return false;
  return crypto.timingSafeEqual(hmac, signature);
}

// Map Lemon variant -> our tier
function tierFromVariant(variantId: string | null) {
  // TODO: set these env vars in Vercel
  const core = process.env.LEMONSQUEEZY_VARIANT_ID_CORE ?? "";
  const pro = process.env.LEMONSQUEEZY_VARIANT_ID_PRO ?? process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY ?? "";

  if (!variantId) return "free";
  if (variantId === pro) return "pro";
  if (variantId === core) return "core";
  return "pro"; // fallback if you only sell Pro today
}

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json("Missing webhook secret", { status: 500 });
  const rawBody = await request.text();
  const sig = request.headers.get("X-Signature") ?? "";

  if (!verifySignature(rawBody, sig, secret)) {
    return NextResponse.json("Invalid signature", { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload?.meta?.event_name ?? "unknown";
  const subId = payload?.data?.id as string | undefined;
  const attr = payload?.data?.attributes ?? {};

  const custom = attr?.checkout_data?.custom ?? {};
  const workspaceId = custom?.workspace_id as string | undefined;

  const status = String(attr?.status ?? "inactive");
  const lemonCustomerId = attr?.customer_id ? String(attr.customer_id) : null;
  const lemonVariantId = attr?.variant_id ? String(attr.variant_id) : null;

  const tier = tierFromVariant(lemonVariantId);

  const trialEndsAt = attr?.trial_ends_at ? new Date(attr.trial_ends_at).toISOString() : null;
  const currentPeriodEndsAt = attr?.renews_at ? new Date(attr.renews_at).toISOString() : null;
  const endsAt = attr?.ends_at ? new Date(attr.ends_at).toISOString() : null;
  const cancelled = Boolean(attr?.cancelled ?? false);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!workspaceId) {
    // Without workspace_id we cannot assign subscription correctly
    return NextResponse.json("OK", { status: 200 });
  }

  await admin.from("workspace_subscriptions").upsert(
    {
      workspace_id: workspaceId,
      lemon_customer_id: lemonCustomerId,
      lemon_subscription_id: subId ?? null,
      lemon_variant_id: lemonVariantId,
      status,
      tier,
      trial_ends_at: trialEndsAt,
      current_period_ends_at: currentPeriodEndsAt,
      ends_at: endsAt,
      cancelled,
      last_event_name: eventName,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );

  // Optional: also store base plan on workspace (for convenience in UI)
  // Note: only set to paid tiers; don't downgrade automatically here.
  if (status === "active" || status === "on_trial" || status === "paused") {
    await admin.from("workspaces").update({ plan: tier }).eq("id", workspaceId);
  }

  return NextResponse.json("OK", { status: 200 });
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
  variant?: "primary" | "secondary" | "danger" | "outline" | "cta";
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
    "inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors duration-150 " +
    "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    // Keep existing look for internal app
    primary:
      "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-300",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-300",
    outline:
      "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300",

    // NEW: for marketing CTAs
    cta:
      "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 focus:ring-blue-300 shadow-sm",
  } as const;

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


## FILE: app\components\PlanPill.tsx

```tsx
"use client";

import React from "react";

export type WorkspaceTier = "free" | "core" | "pro";

function humanStatus(s: string | null | undefined) {
  if (!s) return null;
  switch (s) {
    case "active":
      return "Active";
    case "on_trial":
      return "Trial";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "inactive":
      return null;
    default:
      return s;
  }
}

function pillStyle(tier: WorkspaceTier) {
  if (tier === "pro") return "bg-purple-50 text-purple-800 border-purple-200";
  if (tier === "core") return "bg-blue-50 text-blue-800 border-blue-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default function PlanPill({
  tier,
  billingStatus,
  workspaceName,
  onClick,
}: {
  tier: WorkspaceTier;
  billingStatus?: string | null;
  workspaceName?: string | null;
  onClick?: () => void;
}) {
  const statusLabel = humanStatus(billingStatus ?? null);
  const tierLabel = tier.toUpperCase();
  const label = statusLabel ? `${tierLabel} • ${statusLabel}` : tierLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 text-xs border px-3 py-1.5 rounded-full",
        "hover:bg-white transition",
        pillStyle(tier),
      ].join(" ")}
      title={workspaceName ? `Plan for ${workspaceName}` : "Billing / plan"}
    >
      <span className="font-semibold">{label}</span>
      {tier === "free" ? <span className="text-gray-500">Upgrade</span> : null}
    </button>
  );
}


```


## FILE: app\components\PlanStatusPill.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type SubRow = {
  status: string;
  trial_ends_at: string | null;
};

function pillStyle(kind: "free" | "trial" | "active" | "paused") {
  switch (kind) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "trial":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "paused":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

export default function PlanStatusPill() {
  const router = useRouter();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("user_subscriptions")
        .select("status, trial_ends_at")
        .maybeSingle();

      if (!cancelled) {
        setSub(data ?? null);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const planKind = useMemo(() => {
    if (sub?.status === "active") return "active";
    if (sub?.status === "on_trial") return "trial";
    if (sub?.status === "paused") return "paused";
    return "free";
  }, [sub]);

  async function startTrial() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        router.push("/login?next=/pricing");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!json?.url) throw new Error("No checkout url");

      window.location.href = json.url;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-400">Plan: loading…</div>
    );
  }

  const label =
    planKind === "active"
      ? "Plan: Pro"
      : planKind === "trial"
      ? "Plan: Trial"
      : planKind === "paused"
      ? "Plan: Paused"
      : "Plan: Free";

  return (
  <div className="flex items-center gap-2">
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${pillStyle(
        planKind
      )}`}
    >
      {label}
      {planKind === "trial" && sub?.trial_ends_at ? (
        <span className="ml-1 opacity-70">
          • ends {new Date(sub.trial_ends_at).toLocaleDateString()}
        </span>
      ) : null}
    </div>

    {planKind === "free" ? (
      <Button
        variant="cta"
        disabled={busy}
        onClick={startTrial}
        className="px-3 py-1.5 text-xs"
      >
        Start trial
      </Button>
    ) : null}
  </div>
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


## FILE: app\components\PublicHeader.tsx

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";

export default function PublicHeader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setShow(!data.user);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!show) return null;

  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold text-gray-900">
          Improvica
        </Link>

        <div className="flex items-center gap-2">
          <a href="#pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </a>

          <Link href="/login?mode=signin&next=/projects">
            <Button variant="outline">Log in</Button>
          </Link>

          <Link href="/login?mode=signup&next=/projects">
            <Button>Create account</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}


```


## FILE: app\components\TopNav.tsx

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import PlanPill from "@/app/components/PlanPill";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, WorkspaceRole } from "@/app/lib/appContext";

type Tier = "free" | "core" | "pro";

const navItems = [
  { label: "Projects", to: "/projects" },
  { label: "Kanban", to: "/kanban" },
  { label: "Hours", to: "/hours" },
  { label: "Gantt", to: "/gantt" },
  // ✅ Today removed
];

function initialFromEmail(email: string | null | undefined) {
  const e = (email ?? "").trim();
  if (!e) return "U";
  return e[0].toUpperCase();
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const hideNav = pathname === "/" || pathname?.startsWith("/login");

  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  const [tier, setTier] = useState<Tier>("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);

  // user menu dropdown
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // workspace popover
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement | null>(null);

  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
  try {
    // ---- AUTH (robust) ----
    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr) console.warn("TopNav getUser error:", uErr);

    const user = u.user;

    if (!user) {
      setLoggedIn(false);
      setEmail(null);
      setWorkspaceRole("member");
      setWorkspaceName(null);
      setTier("free");
      setBillingStatus(null);
      return;
    }

    setLoggedIn(true);
    setEmail(user.email ?? null);

    // ---- WORKSPACE ----
    const ws = await getActiveWorkspace();
    if (ws) {
      setWorkspaceRole(ws.role);
      setWorkspaceName(ws.name ?? null);
    } else {
      setWorkspaceRole("member");
      setWorkspaceName(null);
    }

    // ---- BILLING / TIER ----
    const t = await getActiveWorkspaceTier();
    setTier(t as Tier);
  } catch (e) {
    console.warn("TopNav load failed:", e);

    // Fail-safe: never break the nav UI
    setLoggedIn(false);
    setEmail(null);
    setWorkspaceRole("member");
    setWorkspaceName(null);
    setTier("free");
    setBillingStatus(null);
  }
}, []);


  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("workspace-changed", handler);
    };
  }, [load]);

  // Close menus on outside click / escape
  useEffect(() => {
    if (!userMenuOpen && !mobileOpen && !wsOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileOpen(false);
        setWsOpen(false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;

      if (userMenuRef.current && userMenuRef.current.contains(t)) return;
      if (wsRef.current && wsRef.current.contains(t)) return;
      if (mobilePanelRef.current && mobilePanelRef.current.contains(t)) return;

      setUserMenuOpen(false);
      setWsOpen(false);
      setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen, mobileOpen, wsOpen]);

  const me = useMemo(() => initialFromEmail(email), [email]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (hideNav || !loggedIn) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* LEFT: Brand + Desktop nav */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              // ✅ Mobile: toggle menu under logo
              if (typeof window !== "undefined" && window.innerWidth < 640) {
                setMobileOpen((v) => !v);
                setUserMenuOpen(false);
                setWsOpen(false);
                return;
              }
              // Desktop: go projects
              router.push("/projects");
            }}
            className="font-semibold text-gray-900 truncate"
            aria-label="Go to projects"
          >
            <span className="hidden sm:inline">Improvica</span>
            <span className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
              I
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            {navItems.map((it) => (
              <Button
                key={it.to}
                variant="outline"
                onClick={() => router.push(it.to)}
                className={pathname === it.to ? "border-gray-400" : undefined}
              >
                {it.label}
              </Button>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {/* Plan pill (desktop) */}
          <div className="hidden sm:flex items-center">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={workspaceName}
              onClick={() => router.push("/pricing")}
            />
          </div>

          {/* Workspace popover trigger (desktop) */}
          <div className="hidden md:block relative" ref={wsRef}>
            <Button
              variant="outline"
              onClick={() => {
                setWsOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              className="px-3 py-2"
            >
              <span className="max-w-[140px] truncate">
                {workspaceName ? workspaceName : "Workspace"}
              </span>
            </Button>

            {wsOpen ? (
              <div
                className={[
                  "absolute right-0 top-full mt-2 z-50",
                  "w-[320px] max-w-[92vw]",
                  "rounded-2xl border bg-white shadow-lg",
                  "p-3",
                  "max-h-[70vh] overflow-auto",
                ].join(" ")}
              >
                <div className="text-xs text-gray-500 mb-2">Switch workspace</div>
                <WorkspaceSwitcher />
              </div>
            ) : null}
          </div>

          {/* User avatar dropdown (bigger) */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setWsOpen(false);
              }}
              className="h-11 w-11 rounded-full bg-gray-900 text-white text-base font-semibold flex items-center justify-center"
              aria-label="User menu"
            >
              {me}
            </button>

            {userMenuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border bg-white shadow-lg overflow-hidden z-50">
                <div className="px-3 py-2 text-xs text-gray-500 border-b">
                  {email ?? "Signed in"}
                </div>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/account");
                  }}
                >
                  Account
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/admin/users");
                  }}
                >
                  User management
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/pricing");
                  }}
                >
                    Billing
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          {/* ✅ Mobile 3-dots removed */}
        </div>
      </div>

      {/* MOBILE PANEL (opens under logo) */}
      {mobileOpen ? (
        <div className="sm:hidden border-t bg-white" ref={mobilePanelRef}>
          <div className="px-4 py-3 grid gap-2">
            {navItems.map((it) => (
              <button
                key={it.to}
                className={[
                  "text-left px-3 py-2 rounded-xl border",
                  pathname === it.to ? "bg-gray-50 border-gray-300" : "bg-white border-gray-200",
                ].join(" ")}
                onClick={() => {
                  setMobileOpen(false);
                  router.push(it.to);
                }}
              >
                {it.label}
              </button>
            ))}

            <div className="mt-2 rounded-2xl border p-3">
              <div className="text-xs text-gray-500 mb-2">Workspace</div>
              <WorkspaceSwitcher />
            </div>

            <div className="mt-1">
              <PlanPill
                tier={tier}
                billingStatus={billingStatus}
                workspaceName={workspaceName}
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/pricing");
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
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

  // create + rename UI
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
      await setActiveWorkspace(id);

      const next = list.find((w) => w.workspaceId === id) ?? null;
      setActive(next);
      setRenameWsName(next?.name ?? "");

      window.dispatchEvent(new Event("workspace-changed"));
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
      const { data: newId, error } = await supabase.rpc("create_workspace", { p_name: name });
      if (error) throw error;

      setNewWsName("");

      await load();

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
      const { error } = await supabase.from("workspaces").update({ name }).eq("id", active.workspaceId);
      if (error) throw error;

      setList((prev) => prev.map((w) => (w.workspaceId === active.workspaceId ? { ...w, name } : w)));
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
    <div className="grid gap-2 w-full">
      {/* Row 1: switcher + manage toggle */}
      <div className="flex items-center gap-2 w-full flex-wrap">
        <div className="flex-1 min-w-0">
          <select
            className="w-full border rounded-md px-2 py-2 text-sm disabled:opacity-50"
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
        </div>

        <Button
          variant="outline"
          onClick={() => setShowManage((v) => !v)}
          aria-label="Workspace actions"
          className="px-3 py-2 shrink-0"
        >
          ⋯
        </Button>

        {switching ? <span className="text-xs text-gray-500 shrink-0">wisselen…</span> : null}
      </div>

      {/* Row 2: manage panel */}
      {showManage ? (
        <div className="border rounded-lg p-3 bg-gray-50 grid gap-3 w-full">
          {/* Create */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Nieuwe workspace</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm"
                placeholder="Naam…"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
              />
              <Button onClick={createWorkspace} disabled={creating || newWsName.trim().length === 0} className="shrink-0">
                {creating ? "Aanmaken…" : "Aanmaken"}
              </Button>
            </div>
          </div>

          {/* Rename */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Huidige workspace naam</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm"
                placeholder="Nieuwe naam…"
                value={renameWsName}
                onChange={(e) => setRenameWsName(e.target.value)}
                disabled={!canRename}
              />
              <Button
                variant="outline"
                onClick={renameWorkspace}
                disabled={!canRename || renaming || renameWsName.trim().length === 0}
                className="shrink-0"
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
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import "@/app/styles/vendor/frappe-gantt.css";

// --- Minimal types ---
type WsMember = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  profiles?: { email?: string | null; full_name?: string | null };
};

type ProjectStatus = "proposed" | "active" | "done" | "archived";

type TodoRow = {
  id: string;
  title: string;
  project_id: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
};

type GanttTask = {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  custom_class?: string; // must be single token
};

// View rows
type TodoWindowRow = {
  todo_id: string | null;
  project_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

type ProjectWindowRow = {
  project_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

// -------------------- Helpers --------------------
function labelForMember(m: WsMember) {
  const name = (m.profiles?.full_name ?? "").trim();
  const email = (m.profiles?.email ?? "").trim();
  return name || email || m.user_id;
}

function isoToUtcDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addOneDay(date: Date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function measureSvgHeight(container: HTMLDivElement): number | null {
  const svg = container.querySelector("svg") as SVGSVGElement | null;
  if (!svg) return null;

  try {
    // getBBox gives the true content bounds, even if something is clipped/scrollable.
    const bbox = svg.getBBox();
    const h = Math.ceil(bbox.y + bbox.height);
    // buffer for bottom labels/scrollbar area
    return Math.max(420, h + 40);
  } catch {
    // getBBox can throw if SVG isn't ready yet
    return null;
  }
}

// -------------------- Page --------------------
export default function GanttPage() {
  const router = useRouter();

  const [baseLoading, setBaseLoading] = useState(true);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<WsMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const ganttRef = useRef<HTMLDivElement | null>(null);

  // NEW: ref to the horizontal scroll container
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = workspaceRole === "owner" || workspaceRole === "admin";
  const [measuredHeight, setMeasuredHeight] = useState<number>(520);

  const userOptions = useMemo(() => {
    if (!myUserId) return [];
    if (!isAdmin) return members.filter((m) => m.user_id === myUserId);
    return members;
  }, [members, myUserId, isAdmin]);

  const selectedLabel = useMemo(() => {
    const m = members.find((x) => x.user_id === selectedUserId);
    return m ? labelForMember(m) : "";
  }, [members, selectedUserId]);

  const ganttHeight = measuredHeight;

  function centerTodayInView() {
    const scroller = scrollRef.current;
    const container = ganttRef.current;
    if (!scroller || !container) return;

    // In your CSS this is the vertical today line:
    // .gantt-container .current-highlight { ... } :contentReference[oaicite:1]{index=1}
    const todayEl = container.querySelector(".current-highlight") as Element | null;
    if (!todayEl) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const todayRect = todayEl.getBoundingClientRect();

    // Today X inside the scroller content
    const todayCenterX = todayRect.left - scrollerRect.left + todayRect.width / 2;

    // Scroll so that today is centered
    const targetScrollLeft = scroller.scrollLeft + (todayCenterX - scroller.clientWidth / 2);

    // Clamp
    const max = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollLeft = Math.max(0, Math.min(max, targetScrollLeft));
  }

  async function loadBase() {
    setBaseLoading(true);
    setLoadError(null);

    try {
      const user = await requireUser(router);
      if (!user) return;
      setMyUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        setLoadError("No active workspace found.");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setWorkspaceRole(ws.role);

      const { data: mem, error: memErr } = await supabase
        .from("workspace_members")
        .select("id,user_id,role,profiles(email,full_name)")
        .eq("workspace_id", ws.workspaceId)
        .order("created_at", { ascending: true });

      if (memErr) {
        console.error(memErr);
        setLoadError(memErr.message);
        return;
      }

      const list = (((mem as any) ?? []) as WsMember[]).filter((m) => !!m.user_id);
      setMembers(list);

      const selfInList = list.find((m) => m.user_id === user.id)?.user_id;
      const initial = selfInList ?? list[0]?.user_id ?? user.id;
      setSelectedUserId((prev) => prev || initial);
    } catch (e: any) {
      console.error("loadBase failed:", e);
      setLoadError(String(e?.message ?? e));
    } finally {
      setBaseLoading(false);
    }
  }

  async function loadGanttData(pWorkspaceId: string, pUserId: string) {
    setGanttLoading(true);
    setLoadError(null);

    try {
      // 1) Load projects (we need status to hide proposed/archived)
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,name,status")
        .eq("workspace_id", pWorkspaceId)
        .order("inserted_at", { ascending: false });

      if (prErr) throw prErr;

      const allProjects = ((pr as any) ?? []) as ProjectRow[];

      // ✅ Hide proposed + archived
      const visibleProjects = allProjects.filter((p) => p.status !== "proposed" && p.status !== "archived");
      const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));

      const projectById = new Map<string, ProjectRow>();
      for (const p of visibleProjects) projectById.set(p.id, p);

      // If no visible projects -> empty gantt
      if (visibleProjects.length === 0) {
        setTasks([]);
        return;
      }

      // 2) Windows per project (based on Hours)
      const { data: pw, error: pwErr } = await supabase
        .from("time_entries_project_window")
        .select("project_id,start_date,end_date")
        .eq("workspace_id", pWorkspaceId)
        .eq("user_id", pUserId);

      if (pwErr) throw pwErr;

      let projectWindows = (((pw as any) ?? []) as ProjectWindowRow[]).filter((x) => x.project_id);

      // ✅ Filter out proposed/archived projects
      projectWindows = projectWindows.filter((w) => visibleProjectIds.has(w.project_id));

      if (projectWindows.length === 0) {
        setTasks([]);
        return;
      }

      // 3) Windows per todo (based on Hours)
      const { data: tw, error: twErr } = await supabase
        .from("time_entries_todo_window")
        .select("todo_id,project_id,start_date,end_date")
        .eq("workspace_id", pWorkspaceId)
        .eq("user_id", pUserId);

      if (twErr) throw twErr;

      let todoWindows = (((tw as any) ?? []) as TodoWindowRow[]).filter((x) => !!x.todo_id);

      // ✅ Filter out todos belonging to proposed/archived projects
      todoWindows = todoWindows.filter((w) => visibleProjectIds.has(w.project_id));

      // 4) Load todo titles for windowed todo_ids
      const todoIds = Array.from(new Set(todoWindows.map((t) => t.todo_id).filter(Boolean))) as string[];

      const todoById = new Map<string, TodoRow>();
      if (todoIds.length > 0) {
        const { data: td, error: tdErr } = await supabase.from("todos").select("id,title,project_id").in("id", todoIds);

        if (tdErr) throw tdErr;

        for (const t of ((td as any) ?? []) as TodoRow[]) {
          // extra safety: only keep if project is visible
          if (visibleProjectIds.has(t.project_id)) {
            todoById.set(t.id, t);
          }
        }
      }

      // 5) Build todo tasks grouped by project
      const tasksByProject = new Map<string, { todoId: string; title: string; start: string; end: string }[]>();

      for (const w of todoWindows) {
        if (!w.todo_id) continue;

        const todo = todoById.get(w.todo_id);
        if (!todo) continue;

        // safety (should already be true)
        if (!visibleProjectIds.has(todo.project_id)) continue;

        const list = tasksByProject.get(todo.project_id) ?? [];
        list.push({
          todoId: todo.id,
          title: todo.title,
          start: w.start_date,
          end: w.end_date,
        });
        tasksByProject.set(todo.project_id, list);
      }

      // Sort projects by earliest start
      const projOrder = projectWindows
        .filter((p) => tasksByProject.has(p.project_id))
        .sort((a, b) => {
          if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
          return a.project_id.localeCompare(b.project_id);
        });

      // 6) Build final gantt tasks
      const ganttTasks: GanttTask[] = [];

      for (const pwRow of projOrder) {
        const pid = pwRow.project_id;
        const projName = projectById.get(pid)?.name ?? "Project";

        if (!pwRow.start_date || !pwRow.end_date) continue;

        const pStartDate = isoToUtcDate(pwRow.start_date);
        const pEndDate = addOneDay(isoToUtcDate(pwRow.end_date)); // +1 once here

        ganttTasks.push({
          id: `project:${pid}`,
          name: projName,
          start: pStartDate,
          end: pEndDate,
          progress: 0,
          custom_class: "gantt-project",
        });

        const list = tasksByProject.get(pid) ?? [];
        list.sort((a, b) => {
          if (a.start !== b.start) return a.start < b.start ? -1 : 1;
          return a.title.localeCompare(b.title);
        });

        for (const t of list) {
          if (!t.start || !t.end) continue;

          const tStartDate = isoToUtcDate(t.start);
          const tEndDate = addOneDay(isoToUtcDate(t.end)); // +1 once here

          ganttTasks.push({
            id: t.todoId,
            name: `• ${t.title}`,
            start: tStartDate,
            end: tEndDate,
            progress: 0,
            custom_class: "gantt-task",
          });
        }
      }

      setTasks(ganttTasks);
    } catch (e: any) {
      console.error("loadGanttData failed:", e);
      setLoadError(String(e?.message ?? e));
      setTasks([]);
    } finally {
      setGanttLoading(false);
    }
  }

  // Load base
  useEffect(() => {
    loadBase();
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

  // Render chart whenever tasks change
  useEffect(() => {
    if (!ganttRef.current) return;

    async function render() {
      try {
        const mod: any = await import("frappe-gantt");
        const Gantt = mod?.default ?? mod;

        ganttRef.current!.innerHTML = "";

        if (!tasks || tasks.length === 0) {
          ganttRef.current!.innerHTML =
            '<div class="text-sm text-gray-500 p-4">No planned tasks for this user.</div>';
          return;
        }

        requestAnimationFrame(() => {
          // eslint-disable-next-line no-new
          new Gantt(ganttRef.current, tasks, {
            view_mode: "Week",
            bar_height: 20,
            padding: 16,
          });

          // Measure after layout. We do it twice to be safe (Frappe updates DOM in steps).
          const el = ganttRef.current!;
          const applyMeasure = () => {
            const h = measureSvgHeight(el);
            if (h) {
              setMeasuredHeight((prev) => {
                // avoid tiny oscillations that can cause rerenders
                return Math.abs(prev - h) > 8 ? h : prev;
              });
            }
          };

          setTimeout(applyMeasure, 0);
          setTimeout(applyMeasure, 50);

          // ✅ Center “today” in the middle of the viewport
          setTimeout(centerTodayInView, 0);
          setTimeout(centerTodayInView, 60);
          setTimeout(centerTodayInView, 180);
        });
      } catch (e: any) {
        console.error("Render Gantt failed:", e);
        if (ganttRef.current) {
          ganttRef.current.innerHTML = `<div class="text-sm text-red-600 p-4">
            Render failed: ${String(e?.message ?? e)}
          </div>`;
        }
      }
    }

    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // Keep today centered when resizing (optional but nice)
  useEffect(() => {
    const onResize = () => centerTodayInView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (baseLoading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Gantt</h1>
          <div className="text-sm text-gray-500">Role: {workspaceRole}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <section className="mt-6 border rounded-lg p-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">User</label>
            <select
              className="border rounded-md px-3 py-2"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={!isAdmin}
            >
              {userOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {labelForMember(m)} ({m.role})
                </option>
              ))}
            </select>
            {!isAdmin ? <div className="text-xs text-gray-500">You can only view your own planning.</div> : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">What you see</label>
            <div className="text-sm text-gray-700">
              Bars run from <span className="font-medium">first logged day</span> to{" "}
              <span className="font-medium">last logged day</span> (based on Hours).
            </div>
            <div className="text-xs text-gray-500">
              {ganttLoading ? "Loading gantt…" : `Loaded for ${selectedLabel || "selected user"}.`}
            </div>
            <div className="text-xs text-gray-400">
              Hidden here: <span className="font-medium">proposed</span> and <span className="font-medium">archived</span>{" "}
              projects.
            </div>
          </div>
        </div>

        {loadError ? <div className="mt-3 text-sm text-red-600">{loadError}</div> : null}
      </section>

      <section className="mt-6 border rounded-lg bg-white">
        <div ref={scrollRef} className="overflow-x-auto">
          <div ref={ganttRef} className="gantt-container min-w-[900px] p-2 pl-4" style={{ height: ganttHeight }} />
        </div>
      </section>

      <div className="mt-3 text-xs text-gray-500">(c) Improvica 2026.</div>
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


## FILE: app\HomeClient.tsx

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow-sm">
      {children}
    </span>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-semibold text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</div>
    </div>
  );
}

function LeanCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
      <div className="font-semibold text-gray-900">{title}</div>
      <ul className="mt-3 grid gap-2 text-sm text-gray-600">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScreenshotCard({ title, src, alt }: { title: string; src: string; alt: string }) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">preview</div>
      </div>
      <div className="p-3">
        <Image src={src} alt={alt} width={1200} height={750} className="w-full h-auto rounded-xl" priority />
      </div>
    </div>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setChecking(true);
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (cancelled) return;

      if (hasSession) {
        router.replace("/projects");
        return;
      }

      setChecking(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
        <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
            <div className="font-semibold text-gray-900">Improvica Project Planner</div>

            <nav className="flex items-center gap-3">
              {/* pricing is gated → go via login */}
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login?next=/pricing">
                Pricing
              </Link>
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
                Login
              </Link>
              <Link href="/login">
                <Button variant="cta">Create free account</Button>
              </Link>
            </nav>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-gradient-to-b from-blue-50/70 to-transparent">
          <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Improvica Project Planner • Kaizen / PDCA / DMAIC
                </div>

                <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
                  Plan, track and improve your Lean projects — in one place.
                </h1>

                <p className="mt-4 text-lg text-gray-600 leading-7">
                  Organize projects and tasks, plan hours, and measure progress with simple Lean structure.
                  Built for individuals today, scalable to teams and workspaces tomorrow.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link href="/login">
                    <Button variant="cta" className="w-full sm:w-auto">
                      Create free account
                    </Button>
                  </Link>

                  <Link href="/invites">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Accept invite
                    </Button>
                  </Link>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  
                </div>
              </div>

              {/* Hero image / screenshots */}
              <div className="relative">
                <ScreenshotCard
                  title="Projects overview"
                  src="/landing/projects.png"
                  alt="Lean Planner projects overview screenshot"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>Workspaces</Badge>
                  <Badge>Kanban</Badge>
                  <Badge>Hours planning</Badge>
                  <Badge>Progress by time</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">What you can do</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Keep it lightweight: just enough structure to run Lean projects without overcomplicating.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard title="Projects" desc="Create projects with status, priority, deadlines and owners." icon="📌" />
            <FeatureCard title="Tasks" desc="Break down work into actionable tasks and assign them." icon="✅" />
            <FeatureCard title="Kanban" desc="Visualize project + task flow and focus on what matters now." icon="🧩" />
            <FeatureCard
              title="Hours"
              desc="Plan and log time. Track progress based on executed vs planned minutes."
              icon="⏱️"
            />
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <ScreenshotCard title="Kanban" src="/landing/kanban.png" alt="Kanban screenshot" />
            <ScreenshotCard title="Gantt" src="/landing/gantt.png" alt="Gantt screenshot" />
          </div>
        </section>

        {/* LEAN METHODS */}
        <section className="bg-white/60 border-y border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <h2 className="text-2xl font-semibold text-gray-900">Lean-friendly structure</h2>
            <p className="mt-2 text-gray-600 max-w-2xl">
              Use standard projects today, and expand into PDCA or DMAIC when you need more structure.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <LeanCard
                title="Kaizen (standard)"
                bullets={[
                  "Quick improvements with minimal overhead",
                  "Clear status and priority",
                  "Perfect for personal or small teams",
                ]}
              />
              <LeanCard
                title="PDCA (mid-size)"
                bullets={[
                  "Plan → Do → Check → Act structure",
                  "Better follow-up and learning cycle",
                  "Great for recurring improvements",
                ]}
              />
              <LeanCard
                title="DMAIC (large)"
                bullets={[
                  "Define → Measure → Analyze → Improve → Control",
                  "Best for complex process problems",
                  "Strong structure for deeper analysis",
                ]}
              />
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-blue-100 rounded-2xl p-6 bg-blue-50/60 shadow-sm">
              <div>
                <div className="font-semibold text-gray-900">Start free. Upgrade when you execute.</div>
                <div className="text-sm text-gray-600">
                  Create an account first — then start your Pro trial when you’re ready.
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/login">
                  <Button variant="cta">Create free account</Button>
                </Link>
                <Link href="/login?next=/pricing">
                  <Button variant="outline">See Pro pricing</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white/80 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
            <div>© {new Date().getFullYear()} Improvica Project Planner</div>
            <div className="flex gap-3">
              <Link className="hover:text-gray-800" href="/login">
                Login
              </Link>
              <Link className="hover:text-gray-800" href="/invites">
                Accept invite
              </Link>
              <Link className="hover:text-gray-800" href="/login?next=/pricing">
                Pricing
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}


```


## FILE: app\hours\page.tsx

```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type TodoAutoStatus = "proposed" | "active" | "done";

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
};

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number | null;
  auto_status: TodoAutoStatus;

  // attached client-side (since todo_status_auto has no workspace_id)
  projects: { id: string; name: string; status: ProjectStatus } | null;
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
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  const [userId, setUserId] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon–Fri

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key=todo|date

  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Executed minutes per todo (from view)
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
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setWorkspaceRole(ws.role);

      // ✅ STEP 1: Load visible projects for this workspace
      // Hide: proposed + archived
      // Visible: active + done
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,name,status")
        .eq("workspace_id", ws.workspaceId)
        .not("status", "in", '("proposed","archived")');

      if (prErr) {
        console.error("Load projects failed:", prErr);
        setTodos([]);
        setExecutedByTodo({});
      } else {
        const projects = ((pr as any) ?? []) as ProjectRow[];
        const projectIds = projects.map((p) => p.id);

        if (projectIds.length === 0) {
          setTodos([]);
          setExecutedByTodo({});
        } else {
          const projectById: Record<string, ProjectRow> = {};
          for (const p of projects) projectById[p.id] = p;

          // ✅ STEP 2: Load todos via todo_status_auto using project_id IN (...)
          // Hide: todos that are proposed (keep active + done)
          // IMPORTANT: todo_status_auto has NO workspace_id, so we filter by project_id.
          const { data: td, error: tdErr } = await supabase
            .from("todo_status_auto")
            .select("id,project_id,title,assigned_to,estimated_minutes,executed_minutes,auto_status,inserted_at")
            .in("project_id", projectIds)
            .neq("auto_status", "proposed")
            .order("inserted_at", { ascending: false });

          if (tdErr) {
            console.error("Load todos failed:", tdErr);
            setTodos([]);
            setExecutedByTodo({});
          } else {
            const raw = ((td as any) ?? []) as any[];

            // ✅ STEP 3: Attach project info client-side (for grouping + clicking)
            const enriched: TodoRow[] = raw
              .map((t) => ({
                id: String(t.id),
                project_id: String(t.project_id),
                title: String(t.title ?? ""),
                assigned_to: (t.assigned_to as string | null) ?? null,
                estimated_minutes: (t.estimated_minutes as number | null) ?? null,
                executed_minutes: (t.executed_minutes as number | null) ?? null,
                auto_status: (t.auto_status as TodoAutoStatus) ?? "active",
                projects: projectById[String(t.project_id)] ?? null,
              }))
              .filter((t) => !!t.projects); // safety

            // Sort: by project name then by title
            enriched.sort((a, b) => {
              const pa = a.projects?.name ?? "";
              const pb = b.projects?.name ?? "";
              if (pa !== pb) return pa.localeCompare(pb);
              return (a.title ?? "").localeCompare(b.title ?? "");
            });

            setTodos(enriched);

            const execMap: Record<string, number> = {};
            for (const t of enriched) execMap[t.id] = t.executed_minutes ?? 0;
            setExecutedByTodo(execMap);
          }
        }
      }

      // Load time entries for current user + current week (Mon..Fri)
      const fromISO = iso(days[0]);
      const toISO = iso(days[4]);

      const { data: te, error: teErr } = await supabase
        .from("time_entries")
        .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
        .eq("workspace_id", ws.workspaceId)
        .eq("user_id", user.id)
        .gte("entry_date", fromISO)
        .lte("entry_date", toISO);

      if (teErr) {
        console.error("Load time entries failed:", teErr);
        setCells({});
      } else {
        const m: Record<string, EntryCell> = {};
        for (const r of ((te as any) ?? []) as EntryCell[]) {
          m[cellKey(r.todo_id, r.entry_date)] = r;
        }
        setCells(m);
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

    // Empty => delete
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

    // Upsert for current user
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId,
      logged_by: userId,
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

  // Group by project
  const grouped = useMemo(() => {
    const g = new Map<string, { projectId: string; projectName: string; items: TodoRow[] }>();
    for (const t of todos) {
      const pid = t.project_id;
      const pname = t.projects?.name ?? "Project";
      const cur = g.get(pid) ?? { projectId: pid, projectName: pname, items: [] };
      cur.items.push(t);
      g.set(pid, cur);
    }
    return Array.from(g.values());
  }, [todos]);

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
          <h1 className="text-2xl font-semibold">Hours</h1>
          <div className="text-sm text-gray-500">
            Week of {iso(weekStart)} • Role: {workspaceRole}
          </div>
          <div className="text-xs text-gray-400">
            Hidden: projects <span className="font-medium">proposed/archived</span> and tasks{" "}
            <span className="font-medium">proposed</span>. Visible: <span className="font-medium">active/done</span>.
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      {/* Week nav */}
      <section className="mt-5 border rounded-lg bg-white p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button variant="outline" onClick={prevWeek}>
              ← Prev
            </Button>
            <Button variant="outline" onClick={nextWeek}>
              Next →
            </Button>
          </div>

        {/* mobile day picker (mobile only) */}
        <div className="grid gap-1 md:hidden">
          <label className="text-sm font-medium">Mobile day</label>
           <select
            className="border rounded-md px-3 py-2"
            value={mobileDayIndex}
            onChange={(e) => setMobileDayIndex(Number(e.target.value))}
          >
            {days.map((d, i) => (
              <option key={i} value={i}>
                {iso(d)}
                {iso(d) === todayISO ? " (today)" : ""}
              </option>
            ))}
          </select>
        </div>
        </div>
      </section>

      {/* Desktop table */}
      <section className="mt-6 hidden md:block">
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 border-b w-[360px]">Project / Task</th>
                {days.map((d) => {
                  const dISO = iso(d);
                  return (
                    <th key={dISO} className="text-left p-3 border-b w-[140px]">
                      <div className="font-medium">
                        {dISO} {dISO === todayISO ? "• Today" : ""}
                      </div>
                      <div className="text-xs text-gray-500">Total: {minutesToHoursText(dayTotalMinutes(dISO))}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={1 + days.length}>
                    No tasks available (filters may hide everything).
                  </td>
                </tr>
              ) : (
                grouped.map((grp) => (
                  <React.Fragment key={grp.projectId}>
                    {/* Project row (clickable) */}
                    <tr className="bg-white">
                      <td className="p-3 border-b font-semibold text-gray-900" colSpan={1 + days.length}>
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => router.push(`/projects/${grp.projectId}`)}
                        >
                          {grp.projectName}
                        </button>
                      </td>
                    </tr>

                    {grp.items.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/60">
                        <td className="p-3 border-b">
                          <div className="text-gray-900">{t.title}</div>
                          <div className="text-xs text-gray-500 flex gap-2 flex-wrap mt-1">
                            {t.estimated_minutes ? <span>Est: {minutesToHoursText(t.estimated_minutes)}</span> : null}
                            {typeof todoProgress(t) === "number" ? <span>Progress: {todoProgress(t)}%</span> : null}
                            <span className="opacity-70">• {t.auto_status}</span>
                          </div>
                        </td>

                        {days.map((d) => {
                          const dISO = iso(d);
                          const key = cellKey(t.id, dISO);
                          const val = minutesToHoursInput(cells[key]?.minutes ?? null);

                          return (
                            <td key={dISO} className="p-2 border-b align-top">
                              <input
                                className={[
                                  "w-full border rounded-md px-2 py-1",
                                  dISO === todayISO ? "border-gray-900" : "",
                                ].join(" ")}
                                placeholder="h"
                                value={val}
                                onChange={(e) => setCell(t, dISO, e.target.value)}
                                disabled={savingKey === key}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile simplified */}
      <section className="mt-6 md:hidden">
        <div className="border rounded-lg bg-white p-4 overflow-hidden">
          <div className="text-sm text-gray-700">
            Day: <span className="font-medium">{mobileDayISO}</span>{" "}
            {mobileDayISO === todayISO ? <span className="text-gray-900">• Today</span> : null}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total: {minutesToHoursText(dayTotalMinutes(mobileDayISO))}</div>

          <div className="mt-4 grid gap-4">
            {grouped.length === 0 ? (
              <div className="text-sm text-gray-500">No tasks available.</div>
            ) : (
              grouped.map((grp) => (
                <div key={grp.projectId} className="border rounded-lg p-3 overflow-hidden">
                  <button
                  type="button"
                  className="font-semibold text-gray-900 hover:underline break-words whitespace-normal line-clamp-2 text-left w-full"
                  onClick={() => router.push(`/projects/${grp.projectId}`)}
                  >
                  {grp.projectName}
               </button>

                  <div className="mt-2 grid gap-2">
                    {grp.items.map((t) => {
                      const key = cellKey(t.id, mobileDayISO);
                      const val = minutesToHoursInput(cells[key]?.minutes ?? null);

                      return (
                        <div key={t.id} className="flex items-center gap-2 min-w-0">
                     <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-sm text-gray-900 break-words whitespace-normal line-clamp-2">
                          {t.title}
                        </div>
                        <div className="text-xs text-gray-500">
                        {t.estimated_minutes ? `Est: ${minutesToHoursText(t.estimated_minutes)}` : "No estimate"} • {t.auto_status}
                       </div>
                      </div>

                      <input
                      className="w-[86px] shrink-0 border rounded-md px-2 py-1 text-sm"
                        placeholder="h"
                        value={val}
                        onChange={(e) => setCell(t, mobileDayISO, e.target.value)}
                        disabled={savingKey === key}
                      />
                    </div>

                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="mt-3 text-xs text-gray-500">
        (c) Improvica 2026
      </div>
    </main>
  );
}


```


## FILE: app\invite\accept\InviteAcceptClient.tsx

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type Status = "loading" | "need_login" | "accepted" | "already_accepted" | "error";

function friendlyInviteError(message: string): string {
  const msg = (message || "").toLowerCase();

  if (msg.includes("revoked")) {
    return "This invitation was withdrawn by the workspace owner. Please ask for a new invitation.";
  }

  if (msg.includes("expired")) {
    return "This invitation has expired. Please ask for a new invitation.";
  }

  if (msg.includes("not found")) {
    return "This invitation link is invalid or has already been used.";
  }

  if (msg.includes("different email")) {
    return "This invitation was sent to a different email address. Please log in with the correct account.";
  }

  if (msg.includes("not authenticated") || msg.includes("jwt")) {
    return "Your session expired. Please log in again to accept the invitation.";
  }

  // Fallback
  return "Something went wrong while accepting the invitation. Please try again or contact the workspace owner.";
}

export default function InviteAcceptClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  // Prevent double execution in dev (React Strict Mode)
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (startedRef.current) return;
      startedRef.current = true;

      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Missing invite token.");
        }
        return;
      }

      // 1) Ensure logged in
      const { data: userRes, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        if (!cancelled) {
          setStatus("error");
          setMessage(friendlyInviteError(userErr.message));
        }
        return;
      }

      if (!userRes.user) {
        if (!cancelled) {
          setStatus("need_login");
          setMessage("Please log in (or create an account) to accept the invitation.");
        }
        return;
      }

      // 2) Accept invite (IMPORTANT: use correct param name for your DB function)
      // Your function signature is: accept_workspace_invite(invite_token text) returns uuid
      const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invite", {
        invite_token: token,
      });

      if (error) {
        const raw = error.message || "";
        const msg = raw.toLowerCase();

        // ✅ Already accepted → auto redirect (don't show as error)
        // Common messages: "Invite is not pending (status=accepted)" or variants
        if (msg.includes("status=accepted") || (msg.includes("not pending") && msg.includes("accepted"))) {
          if (!cancelled) {
            setStatus("already_accepted");
            setMessage("This invitation was already accepted. Redirecting…");
          }
          setTimeout(() => {
            router.replace("/projects");
          }, 600);
          return;
        }

        if (!cancelled) {
          setStatus("error");
          setMessage(friendlyInviteError(raw));
        }
        return;
      }

      // 3) Success
      if (!cancelled) {
        setStatus("accepted");
        setMessage("Invitation accepted. Redirecting…");
      }

      setTimeout(() => {
        router.replace("/projects");
      }, 800);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Accepting invitation…</div>
      </main>
    );
  }

  if (status === "already_accepted") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">{message}</div>
      </main>
    );
  }

  if (status === "need_login") {
    const next = token ? `/invite/accept?token=${encodeURIComponent(token)}` : "/invite/accept";

    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-lg p-6">
          <h1 className="text-xl font-semibold">Accept invitation</h1>
          <p className="mt-2 text-sm text-gray-600">{message}</p>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/login?next=${encodeURIComponent(next)}`)}>Go to login</Button>
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Cancel
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // accepted OR error
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-gray-700">{message}</p>

        {status === "error" ? (
          <div className="mt-4 flex gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
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
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";
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
  const [tier, setTier] = useState<"free" | "core" | "pro">("free"); // ✅ hier




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

  // Only paid workspaces (core/pro) may change project status in Kanban.
  // Stakeholders are always read-only.
  const canMoveProjects = role !== "stakeholder" && tier !== "free";

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

const t = await getActiveWorkspaceTier();
if (seq === loadSeq.current) setTier(t);



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
  // Hard block: no status changes in Kanban on free workspaces or for stakeholders
  if (tier === "free" || role === "stakeholder") {
    alert("Changing project status in Kanban is available on the paid plan. Upgrade to enable this feature.");
    router.push("/settings/billing");
    return;
  }

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
    disabled={!canMoveProjects}
    onChange={(e) => updateProjectStatus(p.id, e.target.value as ProjectStatus)}
  >
    {STATUS_COLUMNS.map((c) => (
      <option key={c.key} value={c.key}>
        {c.label}
      </option>
    ))}
  </select>

  {!canMoveProjects ? (
    <div className="mt-1 text-[11px] text-amber-700">
      Status changes in Kanban require a paid plan.
    </div>
  ) : null}
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
  applicationName: "Improvica Project Planner",
  title: "Improvica Project Planner",
  description: "Improvica project planner (Kaizen / PDCA / DMAIC)",
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

// Returns 'free' | 'core' | 'pro'
export async function getActiveWorkspaceTier(): Promise<"free" | "core" | "pro"> {
  const ws = await getActiveWorkspace();
  if (!ws?.workspaceId) return "free";

  const { data, error } = await supabase.rpc("workspace_effective_tier", {
    p_workspace_id: ws.workspaceId,
  });

  if (error) {
    console.warn("workspace_effective_tier error:", error);
    return "free";
  }

  const t = String(data ?? "free");
  if (t === "core" || t === "pro") return t;
  return "free";
}

export type WorkspaceRole = "owner" | "admin" | "member" | "stakeholder";

async function getSessionUser() {
  // 1) Fast path: local session
  const { data: sess } = await supabase.auth.getSession();
  if (sess.session?.user) return sess.session.user;

  // 2) Fallback: ask Supabase (network) — fixes “session not yet hydrated” cases
  const { data: u, error } = await supabase.auth.getUser();
  if (error) return null;
  return u.user ?? null;
}

export async function requireUser(router?: { push: (p: string) => void }) {
  const user = await getSessionUser();
  if (!user) {
    router?.push("/login");
    return null;
  }
  return user;
}

export async function getWorkspaceList() {
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
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
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
  if (!user) return null;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    console.warn("getActiveWorkspace profile error:", profErr);
  }

  const list = await getWorkspaceList();
  if (list.length === 0) return null;

  const byProfile = profile?.active_workspace_id
    ? list.find((w) => w.workspaceId === profile.active_workspace_id)
    : null;

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
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
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


## FILE: app\login\LoginClient.tsx

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup";

export default function LoginClient({
  nextPath,
  initialMode,
}: {
  nextPath: string;
  initialMode: Mode;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // If user is already logged in, go to next
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        router.replace(nextPath);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      router.replace(nextPath);
    } catch (err: any) {
      alert(err?.message ?? "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setIsLoading(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: origin
          ? { emailRedirectTo: `${origin}/auth/callback` }
          : undefined,
      });

      if (error) throw error;

      // If email confirmation is enabled, session may be null.
      if (!data.session) {
        setInfo("Account created. Please check your email to confirm your account, then log in.");
        setMode("signin");
        return;
      }

      router.replace(nextPath);
    } catch (err: any) {
      alert(err?.message ?? "Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center p-6">
      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
        <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {mode === "signup"
              ? "Create a free account first. Upgrade to Pro later when you want to start a trial."
              : "Log in to continue."}
          </p>

          {/* Mode switch */}
          <div className="mt-5 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signin" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Register
            </button>
          </div>

          {info ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
              {info}
            </div>
          ) : null}

          <form
            onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
            className="mt-5 grid gap-3"
          >
            <input
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            {/* Clear CTA colors:
                - Primary action = CTA (blue)
                - Secondary = outline
             */}
            <div className="flex gap-2 pt-2">
              {mode === "signin" ? (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    className="flex-1"
                    onClick={() => setMode("signup")}
                  >
                    Register
                  </Button>

                  <Button variant="cta" type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Signing in…" : "Login"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    className="flex-1"
                    onClick={() => setMode("signin")}
                  >
                    Back to login
                  </Button>

                  <Button variant="cta" type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Creating…" : "Create account"}
                  </Button>
                </>
              )}
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500">
            After login you’ll continue to: <span className="font-medium text-gray-700">{nextPath}</span>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link className="text-gray-600 hover:text-gray-900 underline" href="/">
              Back to home
            </Link>
            <Link className="text-gray-600 hover:text-gray-900 underline" href="/pricing">
              Pricing (members)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}


```


## FILE: app\login\page.tsx

```tsx
// app/login/page.tsx
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

type SearchParamsValue = string | string[] | undefined;
type SearchParamsPromise = Promise<Record<string, SearchParamsValue>>;

function pickFirst(v: SearchParamsValue) {
  return Array.isArray(v) ? v[0] : v;
}

function safeInternalPath(p?: string) {
  if (!p) return "/projects";
  if (!p.startsWith("/")) return "/projects";
  return p;
}

export default async function LoginPage({
  searchParams,
}: {
  // NOTE: In your Next.js version, searchParams is typed as a Promise.
  searchParams?: SearchParamsPromise;
}) {
  const sp = searchParams ? await searchParams : {};

  const nextRaw = pickFirst(sp.next);
  const modeRaw = pickFirst(sp.mode);

  const nextPath = safeInternalPath(nextRaw);
  const initialMode = modeRaw === "signup" ? "signup" : "signin";

  return <LoginClient nextPath={nextPath} initialMode={initialMode} />;
}


```


## FILE: app\manifest.ts

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Improvica Project Planner",
    short_name: "Improvica",
    description: "Improvica project planner (Kaizen / PDCA / DMAIC)",
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
// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import Button from "@/app/components/Button";
import PublicHeader from "@/app/components/PublicHeader";

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="border rounded-2xl p-5 bg-white">
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600 leading-6">{text}</div>
    </div>
  );
}

function ScreenshotCard({
  title,
  text,
  src,
}: {
  title: string;
  text: string;
  src: string;
}) {
  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
      <div className="p-5 border-b">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-600">{text}</div>
      </div>
      <div className="p-3">
        <Image
          src={src}
          alt={title}
          width={1400}
          height={900}
          className="w-full h-auto rounded-xl border"
          priority={src.includes("hero")}
        />
      </div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  tagline,
  bullets,
  ctaLabel,
  ctaHref,
  highlight,
  note,
}: {
  name: string;
  price: string;
  tagline: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  note?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white p-6 shadow-sm",
        highlight ? "border-blue-300 ring-2 ring-blue-200" : "border-gray-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{price}</div>
          <div className="mt-2 text-sm text-gray-600">{tagline}</div>
        </div>

        {highlight ? (
          <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Most popular
          </div>
        ) : null}
      </div>

      <ul className="mt-5 grid gap-2 text-sm text-gray-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {note ? <div className="mt-4 text-xs text-gray-500">{note}</div> : null}

      <div className="mt-6">
        <Link href={ctaHref}>
          <Button className="w-full">{ctaLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="font-semibold text-gray-900">{q}</div>
      <div className="mt-2 text-sm text-gray-600 leading-6">{a}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Public top bar (visible when not logged in) */}
      <PublicHeader />


      {/* HERO */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-12">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Improvica • Lean Project Planner
              </div>

              <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
                Turn improvement ideas into executed projects.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-7">
                Capture bottom-up proposals, run structured projects, and track progress with tasks and hours.
                Upgrade when you’re ready to unlock Lean tools like 5x Why and Ishikawa.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Auth-first: create account before billing */}
                <Link href="/login?mode=signup&next=/projects&plan=free">
                  <Button className="w-full sm:w-auto">Create a free workspace</Button>
                </Link>

                <a href="#tour">
                  <Button variant="outline" className="w-full sm:w-auto">
                    See the app
                  </Button>
                </a>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Start free (no payment details) • Install it like an app (PWA) • Cancel anytime
              </div>

              <div className="mt-6 flex items-center gap-3">
                <a href="#pricing" className="text-sm text-blue-700 hover:underline">
                  View pricing →
                </a>
                <Link href="/login?mode=signin&next=/projects" className="text-sm text-gray-600 hover:text-gray-900">
                  Already have an account?
                </Link>
              </div>
            </div>

            <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-medium text-gray-900">Preview</div>
                <div className="text-xs text-gray-500">Projects overview</div>
              </div>
              <div className="p-3">
                <Image
                  src="/landing/hero.png"
                  alt="Improvica preview"
                  width={1400}
                  height={900}
                  className="w-full h-auto rounded-xl border"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Why Improvica</h2>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Most tools are built for task tracking. Improvica is built for continuous improvement: proposals → execution → measurable progress.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureItem
            title="Bottom-up proposals"
            text="Let the whole team propose improvements. Keep ideas flowing without forcing everyone into a paid account."
          />
          <FeatureItem
            title="Execution + progress"
            text="Projects, tasks, hours and progress views help project leads keep momentum and make progress visible."
          />
          <FeatureItem
            title="Lean tools when you upgrade"
            text="Unlock structured problem solving (5x Why, Ishikawa, Project Charter, VSM, …) for serious CI work."
          />
        </div>
      </section>

      {/* TOUR / SCREENSHOTS */}
      <section id="tour" className="bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Product tour</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            A calm, professional workflow that works great on desktop and mobile.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ScreenshotCard
              title="Projects"
              text="Create proposals, run active projects, and keep ownership clear."
              src="/landing/projects.png"
            />
            <ScreenshotCard
              title="Kanban"
              text="Visualize work by status. Keep stakeholders aligned."
              src="/landing/kanban.png"
            />
            <ScreenshotCard
              title="Hours"
              text="Track hours and progress with minimal friction."
              src="/landing/hours.png"
            />
            <ScreenshotCard
              title="Gantt"
              text="Plan timelines and dependencies for larger improvement initiatives."
              src="/landing/gantt.png"
            />
          </div>
        </div>
      </section>

      {/* WORKSPACE PRICING EXPLANATION */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Designed for teams (without per-user pricing)</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          In many organizations only a few project leads actively manage improvements, while the broader team contributes ideas and feedback.
          Improvica supports that reality: plans apply to a workspace, so stakeholders can join and propose improvements without paid seats.
        </p>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Pricing</h2>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Plans are per workspace. Create an account first, then you can upgrade anytime.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="€0"
            tagline="Try the workflow with real features."
            bullets={[
              "Unlimited proposals",
              "Up to 2 active projects per workspace",
              "Projects, tasks, hours, progress",
              "Invite stakeholders (read-only)",
              "No payment details required",
            ]}
            note="Great for evaluating the workflow and collecting proposals."
            ctaLabel="Start Free (create account)"
            ctaHref="/login?mode=signup&next=/projects&plan=free"
          />

          <PriceCard
            name="Core"
            price="€9 / month"
            tagline="Unlimited active projects for a workspace."
            bullets={[
              "Unlimited active projects",
              "Projects + Kanban + Hours + Gantt",
              "For project leads managing real work",
              "Cancel anytime",
            ]}
            note="Best for small teams and startups that want planning without Lean tools."
            ctaLabel="Start Core (create account)"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dcore"
            highlight
          />

          <PriceCard
            name="Pro"
            price="€24 / month"
            tagline="Lean tools for continuous improvement teams."
            bullets={[
              "Everything in Core",
              "Lean tools (5x Why, Ishikawa, Project Charter, VSM, …)",
              "Templates and structured analysis",
              "Export / history (as you release it)",
              "Cancel anytime",
            ]}
            note="Best for CI / Lean teams and Operational Excellence."
            ctaLabel="Start Pro (create account)"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dpro"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="border rounded-2xl p-6 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">FAQ</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FAQItem
              q="Do we pay per user?"
              a="No. Plans apply to a workspace. Invite your whole team and use roles like stakeholder/viewer so they can participate without paid seats."
            />
            <FAQItem
              q="Do I need payment details to start?"
              a="Not for Free. For an upgrade you add payment details during checkout. This keeps the free onboarding frictionless."
            />
            <FAQItem
              q="Can I cancel anytime?"
              a="Yes. You can cancel your workspace subscription anytime and keep access until the end of the current billing period."
            />
            <FAQItem
              q="What does ‘install it like an app’ mean?"
              a="Improvica is a PWA: you can install it on mobile and open it from your home screen like a native app."
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/login?mode=signup&next=/projects">
              <Button className="w-full sm:w-auto">Create a free workspace</Button>
            </Link>
            <Link href="/invites">
              <Button variant="outline" className="w-full sm:w-auto">
                Accept an invite
              </Button>
            </Link>
            <Link href="/login?mode=signin&next=/projects">
              <Button variant="outline" className="w-full sm:w-auto">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}


```


## FILE: app\pricing\page.tsx

```tsx
// app/pricing/page.tsx
import PricingClient from "./PricingClient";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return <PricingClient />;
}


```


## FILE: app\pricing\PricingClient.tsx

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace } from "@/app/lib/appContext";
import PublicHeader from "@/app/components/PublicHeader";

type Plan = "free" | "core" | "pro";

type Capability = {
  key: string;
  label: string;
  description?: string;
  access: Record<Plan, boolean>;
};

type WsSubRow = {
  status: string;
  tier: Plan;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  ends_at: string | null;
  cancelled: boolean | null;
};

function BadgeYes() {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
      Yes
    </span>
  );
}

function BadgeNo() {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 border border-gray-100">
      No
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusBadge(tier: Plan, status: string) {
  const base =
    tier === "pro"
      ? { text: "PRO", cls: "bg-violet-50 text-violet-800 border-violet-200" }
      : tier === "core"
      ? { text: "CORE", cls: "bg-blue-50 text-blue-800 border-blue-200" }
      : { text: "FREE", cls: "bg-amber-50 text-amber-900 border-amber-200" };

  if (tier === "free") return base;

  if (status === "on_trial") return { text: `${base.text} • Trial`, cls: base.cls };
  if (status === "paused") return { text: `${base.text} • Paused`, cls: "bg-gray-50 text-gray-800 border-gray-200" };
  if (status === "cancelled") return { text: `${base.text} • Cancelled`, cls: "bg-rose-50 text-rose-800 border-rose-200" };
  if (status === "expired") return { text: "FREE • Expired", cls: "bg-gray-50 text-gray-700 border-gray-200" };

  return { text: `${base.text} • Active`, cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

function encodeNext(path: string) {
  return encodeURIComponent(path);
}

export default function PricingClient() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  const [sub, setSub] = useState<WsSubRow | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  // Optional: chooser at bottom CTA
  const [selectedPlan, setSelectedPlan] = useState<Exclude<Plan, "free">>("core");

  const capabilities: Capability[] = useMemo(
    () => [
      {
        key: "view",
        label: "View projects / Kanban / Gantt",
        access: { free: true, core: true, pro: true },
      },
      {
        key: "propose",
        label: "Propose projects",
        description: "Submit improvement proposals (status: proposed).",
        access: { free: true, core: true, pro: true },
      },
      {
        key: "execute",
        label: "Edit projects + manage tasks + add hours",
        description: "Execution features for workspace members (stakeholders remain read-only).",
        access: { free: false, core: true, pro: true },
      },
      {
        key: "kanban_edit",
        label: "Change project status in Kanban",
        access: { free: false, core: true, pro: true },
      },
      {
        key: "lean_tools",
        label: "Lean tools (5x Why, Ishikawa, A3, Charter, VSM)",
        description: "Unlocked on Pro.",
        access: { free: false, core: false, pro: true },
      },
    ],
    []
  );

  async function refresh() {
    // Auth state
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    setLoggedIn(!!user);

    if (!user) {
      setWorkspaceId(null);
      setWorkspaceName(null);
      setSub(null);
      setSubLoading(false);
      return;
    }

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      setWorkspaceId(null);
      setWorkspaceName(null);
      setSub(null);
      setSubLoading(false);
      return;
    }

    setWorkspaceId(ws.workspaceId);

    // 1) Workspace name: prefer ws.name, else fetch from DB
    const nameFromWs = (ws as any)?.name as string | undefined;
    if (nameFromWs && nameFromWs.trim()) {
      setWorkspaceName(nameFromWs.trim());
    } else {
      const { data: wRow, error: wErr } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", ws.workspaceId)
        .maybeSingle();

      if (!wErr && wRow?.name) setWorkspaceName(String(wRow.name));
      else setWorkspaceName(null); // show nothing if not available
    }

    // 2) Workspace subscription
    setSubLoading(true);
    const { data: subRow, error } = await supabase
      .from("workspace_subscriptions")
      .select("status,tier,trial_ends_at,current_period_ends_at,ends_at,cancelled")
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();

    if (error) console.warn("Load workspace subscription failed:", error);
    setSub((subRow as any) ?? null);
    setSubLoading(false);
  }

  useEffect(() => {
    refresh();

    const { data: subAuth } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    const handler = () => refresh();
    window.addEventListener("workspace-changed", handler);

    return () => {
      subAuth.subscription.unsubscribe();
      window.removeEventListener("workspace-changed", handler);
    };
  }, []);

  const tier: Plan = sub?.tier ?? "free";
  const status = sub?.status ?? "inactive";
  const badge = statusBadge(tier, status);

  async function startCheckout(plan: Exclude<Plan, "free">) {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        router.push(`/login?mode=signup&next=${encodeNext(`/settings/billing?plan=${plan}`)}`);
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");

      window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Show public header ONLY when logged out */}
      {!loggedIn ? <PublicHeader /> : null}

      {/* Add padding when TopNav is visible (fixed) */}
      <div className={loggedIn ? "pt-20" : ""}>
        {/* Decorative background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
          <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
          <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <section className="relative max-w-6xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-xs text-blue-700 shadow-sm">
              <span className="font-semibold">Workspace plans</span>
              <span className="text-blue-700/80">Pay per workspace — invite stakeholders for free</span>
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900">Pricing</h1>
            <p className="mt-3 text-gray-600 leading-relaxed">
              Free is ideal for proposals and visibility. Core unlocks unlimited active projects. Pro adds Lean tools.
            </p>
          </div>

          {/* Current workspace plan (only if logged in) */}
          {loggedIn ? (
            <div className="mt-8 border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">Current workspace</div>
                    <div className="text-sm text-gray-600">
                      {workspaceName ? workspaceName : "—"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Stakeholders are always read-only by role.
                    </div>
                  </div>

                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${badge.cls}`}>
                    {badge.text}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                {subLoading ? (
                  <div className="text-sm text-gray-600">Loading…</div>
                ) : (
                  <div className="grid gap-2 text-sm text-gray-700">
                    {sub?.trial_ends_at ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">Trial ends</span>
                        <span className="font-medium">{formatDateTime(sub.trial_ends_at)}</span>
                      </div>
                    ) : null}

                    {sub?.current_period_ends_at ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">Current period ends</span>
                        <span className="font-medium">{formatDateTime(sub.current_period_ends_at)}</span>
                      </div>
                    ) : null}

                    {sub?.ends_at ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">Access ends</span>
                        <span className="font-medium">{formatDateTime(sub.ends_at)}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={refresh} disabled={busy}>
                    Refresh status
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/settings/billing")} disabled={busy}>
                    Open billing settings
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Pricing cards */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {/* Free */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="text-sm text-gray-500">Free</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">€0</div>
              <div className="mt-1 text-sm text-gray-600">Unlimited proposals + limited active execution.</div>

              <ul className="mt-6 grid gap-2 text-sm text-gray-700">
                <li className="flex items-center justify-between">
                  <span>Unlimited proposals</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Up to 2 active projects</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Execution features</span> <BadgeNo />
                </li>
                <li className="flex items-center justify-between">
                  <span>Lean tools</span> <BadgeNo />
                </li>
              </ul>

              <div className="mt-6">
                {!loggedIn ? (
                  <Link href="/login?mode=signup&next=/projects">
                    <Button className="w-full">Start Free</Button>
                  </Link>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => router.push("/projects")}>
                    Go to app
                  </Button>
                )}
              </div>
            </div>

            {/* Core */}
            <div className="border border-blue-200 rounded-2xl p-6 bg-white shadow-sm ring-1 ring-blue-200">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-blue-700 font-semibold">Core</div>
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                  Most popular
                </div>
              </div>

              <div className="mt-1 text-3xl font-semibold text-gray-900">€9 / month</div>
              <div className="mt-1 text-sm text-gray-600">Unlimited active projects for your workspace.</div>

              <ul className="mt-6 grid gap-2 text-sm text-gray-700">
                <li className="flex items-center justify-between">
                  <span>Unlimited active projects</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Projects + tasks + hours</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Lean tools</span> <BadgeNo />
                </li>
              </ul>

              <div className="mt-6 grid gap-2">
                <Button disabled={busy} onClick={() => startCheckout("core")} className="w-full">
                  {busy ? "Redirecting…" : "Start Core trial"}
                </Button>
                <div className="text-xs text-gray-500 text-center">Cancel anytime.</div>
              </div>
            </div>

            {/* Pro */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="text-sm text-gray-500 font-semibold">Pro</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">€24 / month</div>
              <div className="mt-1 text-sm text-gray-600">Lean tools for continuous improvement teams.</div>

              <ul className="mt-6 grid gap-2 text-sm text-gray-700">
                <li className="flex items-center justify-between">
                  <span>Everything in Core</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Lean tools</span> <BadgeYes />
                </li>
              </ul>

              <div className="mt-6 grid gap-2">
                <Button variant="outline" disabled={busy} onClick={() => startCheckout("pro")} className="w-full">
                  {busy ? "Redirecting…" : "Start Pro trial"}
                </Button>
                <div className="text-xs text-gray-500 text-center">Best if you want Lean tools.</div>
              </div>
            </div>
          </div>

          {/* Simple plan-only matrix (no roles) */}
          <div className="mt-12 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50/80 to-white border-b border-gray-200">
              <div className="font-medium text-gray-900">What’s included</div>
              <div className="text-sm text-gray-600">Plan comparison (workspace-based).</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-4 border-b border-gray-200 bg-white">Capability</th>
                    <th className="p-4 border-b border-gray-200 bg-amber-50/60">Free</th>
                    <th className="p-4 border-b border-gray-200 bg-blue-50/50">Core</th>
                    <th className="p-4 border-b border-gray-200 bg-violet-50/40">Pro</th>
                  </tr>
                </thead>

                <tbody>
                  {capabilities.map((c) => (
                    <tr key={c.key} className="align-top">
                      <td className="p-4 border-b border-gray-200 bg-white">
                        <div className="font-medium text-gray-900">{c.label}</div>
                        {c.description ? <div className="mt-1 text-xs text-gray-500">{c.description}</div> : null}
                      </td>
                      <td className="p-4 border-b border-gray-200 bg-amber-50/30">{c.access.free ? <BadgeYes /> : <BadgeNo />}</td>
                      <td className="p-4 border-b border-gray-200 bg-blue-50/20">{c.access.core ? <BadgeYes /> : <BadgeNo />}</td>
                      <td className="p-4 border-b border-gray-200 bg-violet-50/10">{c.access.pro ? <BadgeYes /> : <BadgeNo />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 text-xs text-gray-500">
              Note: Workspace roles still apply. Stakeholders remain view-only by design.
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-blue-100 rounded-2xl p-6 bg-blue-50/60 shadow-sm">
            <div>
              <div className="font-semibold text-gray-900">Ready to upgrade your workspace?</div>
              <div className="text-sm text-gray-600">Pick Core for unlimited projects, or Pro for Lean tools.</div>
            </div>

            <div className="flex items-center gap-2">
              <select
                className="border rounded-xl px-3 py-2 text-sm bg-white"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as any)}
              >
                <option value="core">Core (€9)</option>
                <option value="pro">Pro (€24)</option>
              </select>

              <Button disabled={busy} onClick={() => startCheckout(selectedPlan)}>
                {busy ? "Redirecting…" : "Start trial"}
              </Button>
            </div>
          </div>
        </section>

        <footer className="bg-white/80 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
            <div>© {new Date().getFullYear()} Improvica</div>
            <div className="flex gap-3">
              <Link className="hover:text-gray-800" href="/projects">
                App
              </Link>
              <Link className="hover:text-gray-800" href="/settings/billing">
                Billing
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
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
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";

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

type WsMemberOption = { id: string; label: string };

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

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");

  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<ProjectRow | null>(null);

  // active projects limit gating (existing behavior)
  const [activeLimit, setActiveLimit] = useState<number>(2);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [canActivateNow, setCanActivateNow] = useState<boolean>(true);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState("");
  const [locationLink, setLocationLink] = useState("");

  // ---------------------------
  // NEW: Stakeholders
  // ---------------------------
  const [wsMembers, setWsMembers] = useState<WsMemberOption[]>([]);
  const [stakeholderIds, setStakeholderIds] = useState<string[]>([]);

  const isStakeholder = useMemo(() => workspaceRole === "stakeholder", [workspaceRole]);

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

  async function loadStakeholders(workspaceId: string) {
    // 1) workspace members (options)
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(full_name,email)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      console.warn("Load workspace members failed:", memErr);
      setWsMembers([]);
    } else {
      const opts: WsMemberOption[] = ((mem as any[]) ?? []).map((m) => {
        const label =
          (m.profiles?.full_name && String(m.profiles.full_name).trim()) ||
          (m.profiles?.email ? String(m.profiles.email) : null) ||
          String(m.user_id).slice(0, 8);
        return { id: String(m.user_id), label };
      });
      setWsMembers(opts);
    }

    // 2) current stakeholders on this project
    const { data: pm, error: pmErr } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);

    if (pmErr) {
      console.warn("Load project members failed:", pmErr);
      setStakeholderIds([]);
      return;
    }

    const ids = ((pm as any[]) ?? [])
      .filter((r) => String(r.role) === "stakeholder")
      .map((r) => String(r.user_id));

    setStakeholderIds(ids);
  }

  async function load() {
  setLoading(true);

  try {
    const user = await requireUser(router);
    if (!user) return;

    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    // Load effective tier (free/core/pro)
    const t = await getActiveWorkspaceTier();
    setTier(t);

    // Project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select(
        "id,workspace_id,name,description,status,owner_id,created_by,deadline,estimated_minutes,priority,project_type,phase,location_link"
      )
      .eq("id", projectId)
      .single();

    if (projErr) {
      alert(projErr.message);
      router.push(`/projects/${projectId}`);
      return;
    }

    const pr = proj as ProjectRow;
    setProject(pr);

    // Project membership role (for member collaboration)
    const { data: pm, error: pmErr } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (pmErr) console.warn("Load project member role failed:", pmErr);
    setProjectMemberRole((pm as any)?.role ?? null);

    // Precheck active count (exclude current project id)
    const limit = 2;
    setActiveLimit(limit);

    const { count, error: cntErr } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", pr.workspace_id)
      .eq("status", "active")
      .neq("id", pr.id);

    if (cntErr) {
      console.warn("Active projects count error:", cntErr);
      setActiveCount(0);
      setCanActivateNow(true);
      setLimitMsg(null);
    } else {
      const n = count ?? 0;
      setActiveCount(n);

      const ok = t !== "free" || n < limit || pr.status === "active";
      setCanActivateNow(ok);

      if (t === "free" && !ok) {
        setLimitMsg(
          `Free plan limit reached: you already have ${n}/${limit} active projects. Upgrade to activate more projects, or keep this as proposed.`
        );
      } else {
        setLimitMsg(null);
      }
    }

    // init form
    setName(pr.name ?? "");
    setDescription(pr.description ?? "");
    setDeadline(pr.deadline ?? "");
    setEstimatedHours(minutesToHoursText(pr.estimated_minutes ?? null));
    setPriority(pr.priority ?? "medium");
    setStatus(pr.status ?? "active");
    setProjectType(pr.project_type ?? "standard");
    setPhase(pr.phase ?? "");
    setLocationLink(pr.location_link ?? "");
  } catch (e: any) {
    console.error("Project edit load failed:", e);
    alert(e?.message ?? "Failed to load project.");
  } finally {
    setLoading(false);
  }
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

  // If free + cap reached, don't allow switching to active (UI safety)
  useEffect(() => {
    if (!project) return;
    const isSwitchingToActive = project.status !== "active" && status === "active";
    if (tier === "free" && !isStakeholder && isSwitchingToActive && !canActivateNow) {
      setStatus("proposed");
    }
  }, [tier, isStakeholder, status, canActivateNow, project]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
    if (isStakeholder) return [{ value: "proposed", label: "proposed" }];

    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active", disabled: tier === "free" && !canActivateNow },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ];
  }, [isStakeholder, tier, canActivateNow]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!canEdit) {
      alert("You don’t have permission to edit this project.");
      return;
    }
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) {
      alert("Name is required.");
      return;
    }

    const nextPhase = projectType === "standard" ? null : phase || null;
    const estMin = hoursTextToMinutes(estimatedHours);

    setSaving(true);

    // 1) update project (unchanged)
    const { error: upErr } = await supabase
      .from("projects")
      .update({
        name: cleanName,
        description: description.trim() || null,
        deadline: deadline ? deadline : null,
        estimated_minutes: estMin,
        priority,
        status,
        project_type: projectType,
        phase: nextPhase,
        location_link: locationLink.trim() || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", project.id);

    if (upErr) {
      console.error("Save project error:", upErr);
      alert(upErr.message);
      setSaving(false);
      return;
    }

    // 2) NEW: save stakeholders (only for non-stakeholders; keep current behavior)
    if (!isStakeholder) {
      const { error: stErr } = await supabase.rpc("set_project_stakeholders", {
        p_project_id: project.id,
        p_user_ids: stakeholderIds,
      });

      if (stErr) {
        console.error("Save stakeholders error:", stErr);
        alert(stErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
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
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">Edit project</h1>

          {limitMsg ? (
            <div className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">{limitMsg}</div>
          ) : null}
        </div>
      </header>

      <form onSubmit={save} className="mt-6 grid gap-4 bg-white border rounded-lg p-6">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Name</label>
          <input className="border rounded-md px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea className="border rounded-md px-3 py-2 min-h-[90px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input className="border rounded-md px-3 py-2" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 2.5"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select className="border rounded-md px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select className="border rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>

            {tier === "free" && !canActivateNow && !isStakeholder ? (
              <div className="text-xs text-amber-700 mt-1">
                You reached the free limit for active projects. Choose <b>proposed</b> or upgrade.
              </div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select className="border rounded-md px-3 py-2" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>
        </div>

        {projectType !== "standard" ? (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select className="border rounded-md px-3 py-2" value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">Select…</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. c:\\projects\\..."
          />
        </div>

        {/* ---------------------------
            NEW: Stakeholders multiselect
           --------------------------- */}
        {!isStakeholder ? (
          <div className="grid gap-2">
            <label className="text-sm font-medium">Stakeholders</label>
            <div className="text-xs text-gray-500">
              Select workspace members to grant access to this project (including chat).
            </div>

            <div className="border rounded-lg p-3 grid gap-2 max-h-64 overflow-auto">
              {wsMembers.length === 0 ? (
                <div className="text-sm text-gray-500">No workspace members found.</div>
              ) : (
                wsMembers.map((m) => {
                  const checked = stakeholderIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setStakeholderIds((cur) =>
                            e.target.checked ? Array.from(new Set([...cur, m.id])) : cur.filter((x) => x !== m.id)
                          );
                        }}
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button variant="outline" type="button" onClick={() => router.push("/projects")} disabled={saving}>
            Cancel
          </Button>
        </div>

        <div className="text-xs text-gray-500 pt-2">
          Plan: <span className="font-medium">{tier}</span> • Active projects:{" "}
          <span className="font-medium">
            {activeCount}/{activeLimit}
          </span>
        </div>
      </form>
    </main>
  );
}


```


## FILE: app\projects\[id]\page.tsx

```tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, metaBadgeClass } from "@/app/lib/badges";

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

  // Added for chat insert
  workspace_id?: string | null;
};

type TodoAuto = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number; // from view
  auto_status: "proposed" | "active" | "done"; // from view
  phase: string | null;
  sort_order: number | null;
};

type Member = { id: string; full_name: string; email: string | null };

// ---- NEW: Chat types ----
type ProjectMessage = {
  id: string;
  project_id: string;
  workspace_id: string;
  user_id: string;
  body: string;
  inserted_at: string;
};

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

function badgeClassForStatus(s: ProjectStatus) {
  switch (s) {
    case "proposed":
      return "bg-amber-50 text-amber-900 border border-amber-200";
    case "active":
      return "bg-emerald-50 text-emerald-900 border border-emerald-200";
    case "done":
      return "bg-blue-50 text-blue-900 border border-blue-200";
    case "archived":
      return "bg-gray-50 text-gray-700 border border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function badgeClassForPriority(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return "bg-rose-50 text-rose-900 border border-rose-200";
  if (v === "high") return "bg-orange-50 text-orange-900 border border-orange-200";
  if (v === "medium") return "bg-amber-50 text-amber-900 border border-amber-200";
  return "bg-gray-50 text-gray-700 border border-gray-200";
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

  // ---------------------------
  // NEW: Chat state
  // ---------------------------
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const labelForUser = useCallback(
    (uid: string) => {
      const m = members.find((x) => x.id === uid);
      if (!m) return uid.slice(0, 8);
      const name = (m.full_name ?? "").trim();
      if (name) return name;
      return m.email ?? uid.slice(0, 8);
    },
    [members]
  );

  const unreadCount = useMemo(() => {
    if (!lastReadAt) return 0;
    const lr = new Date(lastReadAt).getTime();
    return messages.filter((m) => new Date(m.inserted_at).getTime() > lr).length;
  }, [messages, lastReadAt]);

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

    // NOTE: workspace_id is included to support chat insert
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("id,workspace_id,name,description,status,owner_id,created_by,deadline,priority,project_type,phase,location_link")
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
    // Prefer the view that calculates auto status based on hours (as in Kanban)
    const { data, error } = await supabase
      .from("todo_status_auto")
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

      // NEW: load chat after we have userId + project
      await loadChat(projectId);
      await markChatRead(projectId);
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

    const defaultPhase =
      project.project_type && project.project_type !== "standard"
        ? clampPhase(project.project_type, project.phase)
        : null;

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
      p_items: payload,
    });

    if (error) {
      console.error(error);
      alert(error.message);
      await refreshAll(); // revert to server truth
    }
  }

  // ---------------------------
  // NEW: Chat loaders/actions
  // ---------------------------
  async function loadChat(pid: string) {
    if (!pid) return;
    setMsgLoading(true);

    const { data, error } = await supabase
      .from("project_messages")
      .select("id,project_id,workspace_id,user_id,body,inserted_at")
      .eq("project_id", pid)
      .order("inserted_at", { ascending: true })
      .limit(200);

    if (error) {
      console.warn("Load chat messages failed:", error);
      setMessages([]);
      setMsgLoading(false);
      return;
    }

    setMessages(((data as any) ?? []) as ProjectMessage[]);

    if (userId) {
      const { data: rr, error: rrErr } = await supabase
        .from("project_message_reads")
        .select("last_read_at")
        .eq("project_id", pid)
        .eq("user_id", userId)
        .maybeSingle();

      if (!rrErr) setLastReadAt((rr as any)?.last_read_at ?? null);
    }

    setMsgLoading(false);
  }

  async function markChatRead(pid: string) {
    if (!userId) return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("project_message_reads").upsert({
      project_id: pid,
      user_id: userId,
      last_read_at: nowIso,
    });

    if (error) {
      console.warn("Mark read failed:", error);
      return;
    }

    setLastReadAt(nowIso);
  }

  async function sendMessage() {
    if (!project?.workspace_id) {
      alert("Project workspace_id missing (required for chat insert).");
      return;
    }
    if (!userId) return;

    const body = newMsg.trim();
    if (!body) return;

    setNewMsg("");

    const { error } = await supabase.from("project_messages").insert({
      project_id: projectId,
      workspace_id: project.workspace_id,
      user_id: userId,
      body,
    });

    if (error) {
      console.error("Send message error:", error);
      alert(error.message);
      setNewMsg(body);
      return;
    }

    await markChatRead(projectId);
  }

  // NEW: realtime subscription for chat (INSERT only)
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const msg = payload.new as any as ProjectMessage;

          setMessages((cur) => {
            if (cur.some((x) => x.id === msg.id)) return cur;
            return [...cur, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

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

            {/* NEW: unread badge */}
            {unreadCount > 0 ? <span className={metaBadgeClass()}>unread: {unreadCount}</span> : null}
          </div>

          {project.description ? <p className="mt-3 text-sm text-gray-700">{project.description}</p> : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/edit`)}
            disabled={!canEditProject || isStakeholder}
          >
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
            <div className="text-xs text-gray-500">Drag & drop to change order. “Done” is based on logged hours (100%).</div>
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
                    if (!canEditTodos) return;
                    e.preventDefault();
                    onDragOver(t.id);
                  }}
                  onDrop={(e) => {
                    if (!canEditTodos) return;
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
                      <div className="font-medium text-sm break-words whitespace-normal line-clamp-2 sm:line-clamp-1">
                        {t.title}
                      </div>

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
                          <span className={metaBadgeClass()}>phase: {t.phase ?? "—"}</span>
                        ) : null}
                      </div>
                    </div>

                    {canEditTodos ? (
                      <Button variant="danger" className="text-xs px-2 py-1 shrink-0" onClick={() => removeTodo(t.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>

                  {/* ✅ Restored: task controls */}
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

                  {/* ✅ Restored: per-task progressbar */}
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

      {/* ---------------------------
          NEW: Chat UI section
         --------------------------- */}
      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">Project chat</div>
            <div className="text-xs text-gray-500">Realtime messages for all project stakeholders.</div>
          </div>

          <Button variant="outline" className="text-xs px-3 py-2" onClick={() => markChatRead(projectId)} disabled={!userId}>
            Mark read
          </Button>
        </div>

        <div className="mt-4 border rounded-lg p-3 max-h-80 overflow-auto bg-white">
          {msgLoading ? (
            <div className="text-sm text-gray-500">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-gray-500">No messages yet.</div>
          ) : (
            <ul className="grid gap-3">
              {messages.map((m) => {
                const mine = userId && m.user_id === userId;
                return (
                  <li key={m.id} className="text-sm">
                    <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                      <span className={metaBadgeClass()}>{mine ? "you" : labelForUser(m.user_id)}</span>
                      <span className={metaBadgeClass()}>{new Date(m.inserted_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="Write a message…"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!userId}
          />
          <Button onClick={sendMessage} disabled={!userId}>
            Send
          </Button>
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
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";
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

  // Workspace tier
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");

  // Free limit precheck (active projects)
  const [activeCount, setActiveCount] = useState<number>(0);
  const [activeLimit, setActiveLimit] = useState<number>(2);
  const [canCreateActiveNow, setCanCreateActiveNow] = useState<boolean>(true);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

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
  let cancelled = false;

  async function init() {
    setLoading(true);

    try {
      const user = await requireUser(router);
      if (!user) return;
      if (cancelled) return;

      setUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        alert("No active workspace found.");
        router.push("/projects");
        return;
      }
      if (cancelled) return;

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      // Load effective tier (free/core/pro)
      const t = await getActiveWorkspaceTier();
      if (cancelled) return;
      setTier(t);

      // Precheck active project count (free UX)
      const { count, error: cntErr } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.workspaceId)
        .eq("status", "active");

      if (cancelled) return;

      if (cntErr) {
        console.warn("Active projects count error:", cntErr);
        setActiveCount(0);
        setActiveLimit(2);
        setCanCreateActiveNow(true);
        setLimitMsg(null);
      } else {
        const n = count ?? 0;
        setActiveCount(n);

        const limit = 2;
        setActiveLimit(limit);

        const ok = t !== "free" || n < limit;
        setCanCreateActiveNow(ok);

        if (t === "free" && !ok) {
          setLimitMsg(
            `Free plan limit reached: you already have ${n}/${limit} active projects. Upgrade to create more active projects, or create a proposal instead.`
          );
        } else {
          setLimitMsg(null);
        }
      }

      // Default status:
      const canCreateActiveDefault = ws.role !== "stakeholder";
      setStatus(canCreateActiveDefault ? "active" : "proposed");
    } catch (e: any) {
      console.error("Project new init failed:", e);
      alert(e?.message ?? "Failed to initialize project creation.");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  init();
  return () => {
    cancelled = true;
  };
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

  // If free + active limit reached, do not keep status on "active"
  useEffect(() => {
    if (tier === "free" && !isStakeholder && status === "active" && !canCreateActiveNow) {
      setStatus("proposed");
    }
  }, [tier, isStakeholder, status, canCreateActiveNow]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
    if (isStakeholder) {
      return [{ value: "proposed", label: "proposed" }];
    }

    // Free: proposed + active (active disabled if cap reached). Done/archived only for paid tiers.
    if (tier === "free") {
      return [
        { value: "proposed", label: "proposed" },
        { value: "active", label: "active", disabled: !canCreateActiveNow },
      ];
    }

    // Core/Pro: all statuses
    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ];
  }, [isStakeholder, tier, canCreateActiveNow]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Please enter a title.");
    if (!workspaceId || !userId) return alert("No workspace or user found.");

    // Friendly pre-check to avoid ugly RLS error
    if (tier === "free" && !isStakeholder && status === "active" && !canCreateActiveNow) {
      alert(`Free plan limit reached (${activeCount}/${activeLimit} active projects). Please upgrade or create a proposal.`);
      return;
    }

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

      // owner_id is null for proposals
      owner_id: nextStatus === "proposed" ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { error } = await supabase.from("projects").insert(payload);

    setSaving(false);

    if (error) {
      const msg = (error.message ?? "Save failed").toLowerCase();

      // Map common "limit reached" errors to a nicer text
      if (msg.includes("limit") || msg.includes("can_create_active_project")) {
        alert(
          `Free plan limit reached (${activeCount}/${activeLimit} active projects). Upgrade to create more active projects, or create a proposal.`
        );
        return;
      }

      alert(error.message);
      return;
    }

    router.push("/projects");
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
  <h1 className="text-2xl font-semibold">Add Project</h1>
</div>


      {/* Pre-warning banner for free limit */}
      {tier === "free" && limitMsg ? (
        <div className="mt-4 border rounded-lg p-3 bg-amber-50 text-amber-900 text-sm">
          <div className="font-medium">Active project limit reached</div>
          <div className="mt-1">{limitMsg}</div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => router.push("/settings/billing")}>
              Upgrade
            </Button>
            <Button variant="outline" onClick={() => setStatus("proposed")}>
              Create as proposal
            </Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project title"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[90px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              className="border rounded-md px-3 py-2"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 12.5"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very high</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Small hint under the dropdown */}
            {tier === "free" && !canCreateActiveNow ? (
              <div className="text-xs text-amber-700 mt-1">
                You reached the free limit for active projects. Choose <b>proposed</b> or upgrade.
              </div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>
        </div>

        {projectType !== "standard" ? (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select
              className="border rounded-md px-3 py-2"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              <option value="">Select…</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. c:\\projects\\..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button variant="outline" type="button" onClick={() => router.push("/projects")} disabled={saving}>
            Cancel
          </Button>
        </div>

        {/* Debug (optioneel - kun je later weghalen) */}
        <div className="text-xs text-gray-500 pt-2">
          Plan: <span className="font-medium">{tier}</span> • Active projects:{" "}
          <span className="font-medium">
            {activeCount}/{activeLimit}
          </span>
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
                    <div className="font-medium break-words whitespace-normal line-clamp-2 sm:line-clamp-1">
                          {p.name}
                    </div>
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


## FILE: app\settings\billing\BillingClient.tsx

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";
import { getActiveWorkspace } from "@/app/lib/appContext";

type WsSubRow = {
  status: string;
  tier: "free" | "core" | "pro";
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  ends_at: string | null;
  cancelled: boolean;
};

type Plan = "core" | "pro";

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sub, setSub] = useState<WsSubRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [workspaceName, setWorkspaceName] = useState<string | null>(null);


  // Plan selected from landing CTA: ?plan=core|pro
  const selectedPlan: Plan = useMemo(() => {
    const p = sp.get("plan");
    return p === "core" ? "core" : "pro";
  }, [sp]);

  async function load() {
  setLoading(true);

  try {
    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      setWorkspaceId(null);
      setWorkspaceName(null);
      setSub(null);
      return;
    }

    setWorkspaceId(ws.workspaceId);
    setWorkspaceName((ws as any)?.name ?? null);

    const { data, error } = await supabase
      .from("workspace_subscriptions")
      .select("status,tier,trial_ends_at,current_period_ends_at,ends_at,cancelled")
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setSub(null);
      return;
    }

    setSub((data as any) ?? null);
  } catch (e: any) {
    console.error("Billing load failed:", e);
    setSub(null);
  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
    load();
    if (sp.get("success") === "1") load();

    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        // Preserve intent: back here after login
        router.push(`/login?mode=signin&next=${encodeURIComponent(`/settings/billing?plan=${selectedPlan}`)}`);
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");

      window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const status = sub?.status ?? "inactive";
  const tier = sub?.tier ?? "free";
  const isPaid = tier === "core" || tier === "pro";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Billing</h1>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">Workspace</div>
            <div className="text-sm">
               {workspaceName ? workspaceName : workspaceId ? `${workspaceId.slice(0, 8)}…` : "-"}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-medium">Current plan</div>
            <div className="text-sm">{tier}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-medium">Billing status</div>
            <div className="text-sm">{status}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-medium">Selected upgrade</div>
            <div className="text-sm">{selectedPlan}</div>
          </div>

          {sub?.trial_ends_at ? (
            <div className="text-sm text-gray-600">
              Trial ends: {new Date(sub.trial_ends_at).toLocaleString()}
            </div>
          ) : null}

          {isPaid ? (
            <div className="text-sm text-green-700">You have access to paid features for this workspace.</div>
          ) : (
            <div className="text-sm text-amber-700">This workspace is on the free plan. Some features are locked.</div>
          )}

          <div className="text-xs text-gray-500 pt-2">
            Cancel anytime. You keep access until the end of the current billing period.
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={startCheckout}>
          {busy ? "Redirecting…" : `Start ${selectedPlan.toUpperCase()} trial`}
        </Button>

        <Button variant="outline" onClick={load} disabled={busy}>
          Refresh status
        </Button>
      </div>
    </div>
  );
}


```


## FILE: app\settings\billing\page.tsx

```tsx
// app/settings/billing/page.tsx
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return <BillingClient />;
}


```


## FILE: app\styles\vendor\frappe-gantt.css

```css
:root {
  --g-arrow-color: #1f2937;
  --g-bar-color: #fff;
  --g-bar-border: #fff;
  --g-tick-color-thick: #ededed;
  --g-tick-color: #f3f3f3;
  --g-actions-background: #f3f3f3;
  --g-border-color: #ebeff2;
  --g-text-muted: #7c7c7c;
  --g-text-light: #fff;
  --g-text-dark: #171717;
  --g-progress-color: #dbdbdb;
  --g-handle-color: #37352f;
  --g-weekend-label-color: #dcdce4;
  --g-expected-progress: #c4c4e9;
  --g-header-background: #fff;
  --g-row-color: #fdfdfd;
  --g-row-border-color: #c7c7c7;
  --g-today-highlight: #37352f;
  --g-popup-actions: #ebeff2;
  --g-weekend-highlight-color: #f7f7f7;
}
.gantt-container {
  line-height: 14.5px;
  position: relative;
  overflow: auto;
  font-size: 12px;
  height: var(--gv-grid-height);
  width: 100%;
  border-radius: 8px;
}
.gantt-container .popup-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  background: #fff;
  box-shadow: 0 10px 24px -3px #0003;
  padding: 10px;
  border-radius: 5px;
  width: max-content;
  z-index: 1000;
}
.gantt-container .popup-wrapper .title {
  margin-bottom: 2px;
  color: var(--g-text-dark);
  font-size: 0.85rem;
  font-weight: 650;
  line-height: 15px;
}
.gantt-container .popup-wrapper .subtitle {
  color: var(--g-text-dark);
  font-size: 0.8rem;
  margin-bottom: 5px;
}
.gantt-container .popup-wrapper .details {
  color: var(--g-text-muted);
  font-size: 0.7rem;
}
.gantt-container .popup-wrapper .actions {
  margin-top: 10px;
  margin-left: 3px;
}
.gantt-container .popup-wrapper .action-btn {
  border: none;
  padding: 5px 8px;
  background-color: var(--g-popup-actions);
  border-right: 1px solid var(--g-text-light);
}
.gantt-container .popup-wrapper .action-btn:hover {
  background-color: brightness(97%);
}
.gantt-container .popup-wrapper .action-btn:first-child {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
.gantt-container .popup-wrapper .action-btn:last-child {
  border-right: none;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
.gantt-container .grid-header {
  height: calc(
    var(--gv-lower-header-height) + var(--gv-upper-header-height) + 10px
  );
  background-color: var(--g-header-background);
  position: sticky;
  top: 0;
  left: 0;
  border-bottom: 1px solid var(--g-row-border-color);
  z-index: 1000;
}
.gantt-container .lower-text,
.gantt-container .upper-text {
  text-anchor: middle;
}
.gantt-container .upper-header {
  height: var(--gv-upper-header-height);
}
.gantt-container .lower-header {
  height: var(--gv-lower-header-height);
}
.gantt-container .lower-text {
  font-size: 12px;
  position: absolute;
  width: calc(var(--gv-column-width) * 0.8);
  height: calc(var(--gv-lower-header-height) * 0.8);
  margin: 0 calc(var(--gv-column-width) * 0.1);
  align-content: center;
  text-align: center;
  color: var(--g-text-muted);
}
.gantt-container .upper-text {
  position: absolute;
  width: fit-content;
  font-weight: 500;
  font-size: 14px;
  color: var(--g-text-dark);
  height: calc(var(--gv-lower-header-height) * 0.66);
}
.gantt-container .current-upper {
  position: sticky;
  left: 0 !important;
  padding-left: 17px;
  background: #fff;
}
.gantt-container .side-header {
  position: sticky;
  top: 0;
  right: 0;
  float: right;
  z-index: 1000;
  line-height: 20px;
  font-weight: 400;
  width: max-content;
  margin-left: auto;
  padding-right: 10px;
  padding-top: 10px;
  background: var(--g-header-background);
  display: flex;
}
.gantt-container .side-header * {
  transition-property: background-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 0.15s;
  background-color: var(--g-actions-background);
  border-radius: 0.5rem;
  border: none;
  padding: 5px 8px;
  color: var(--g-text-dark);
  font-size: 14px;
  letter-spacing: 0.02em;
  font-weight: 420;
  box-sizing: content-box;
  margin-right: 5px;
}
.gantt-container .side-header *:last-child {
  margin-right: 0;
}
.gantt-container .side-header *:hover {
  filter: brightness(97.5%);
}
.gantt-container .side-header select {
  width: 60px;
  padding-top: 2px;
  padding-bottom: 2px;
}
.gantt-container .side-header select:focus {
  outline: none;
}
.gantt-container .date-range-highlight {
  background-color: var(--g-progress-color);
  border-radius: 12px;
  height: calc(var(--gv-lower-header-height) - 6px);
  top: calc(var(--gv-upper-header-height) + 5px);
  position: absolute;
}
.gantt-container .current-highlight {
  position: absolute;
  background: var(--g-today-highlight);
  width: 1px;
  z-index: 999;
}
.gantt-container .current-ball-highlight {
  position: absolute;
  background: var(--g-today-highlight);
  z-index: 1001;
  border-radius: 50%;
}
.gantt-container .current-date-highlight {
  background: var(--g-today-highlight);
  color: var(--g-text-light);
  border-radius: 5px;
}
.gantt-container .holiday-label {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  z-index: 1000;
  background: --g-weekend-label-color;
  border-radius: 5px;
  padding: 2px 5px;
}
.gantt-container .holiday-label.show {
  opacity: 100;
}
.gantt-container .extras {
  position: sticky;
  left: 0;
}
.gantt-container .extras .adjust {
  position: absolute;
  left: 8px;
  top: calc(var(--gv-grid-height) - 60px);
  background-color: #000000b3;
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 3px;
}
.gantt-container .hide {
  display: none;
}
.gantt {
  user-select: none;
  -webkit-user-select: none;
  position: absolute;
}
.gantt .grid-background {
  fill: none;
}
.gantt .grid-row {
  fill: var(--g-row-color);
}
.gantt .row-line {
  stroke: var(--g-border-color);
}
.gantt .tick {
  stroke: var(--g-tick-color);
  stroke-width: 0.4;
}
.gantt .tick.thick {
  stroke: var(--g-tick-color-thick);
  stroke-width: 0.7;
}
.gantt .arrow {
  fill: none;
  stroke: var(--g-arrow-color);
  stroke-width: 1.5;
}
.gantt .bar-wrapper .bar {
  fill: var(--g-bar-color);
  stroke: var(--g-bar-border);
  stroke-width: 0;
  transition: stroke-width 0.3s ease;
}
.gantt .bar-progress {
  fill: var(--g-progress-color);
  border-radius: 4px;
}
.gantt .bar-expected-progress {
  fill: var(--g-expected-progress);
}
.gantt .bar-invalid {
  fill: transparent;
  stroke: var(--g-bar-border);
  stroke-width: 1;
  stroke-dasharray: 5;
}
:is(.gantt .bar-invalid) ~ .bar-label {
  fill: var(--g-text-light);
}
.gantt .bar-label {
  fill: var(--g-text-dark);
  dominant-baseline: central;
  font-family: Helvetica;
  font-size: 13px;
  font-weight: 400;
}
.gantt .bar-label.big {
  fill: var(--g-text-dark);
  text-anchor: start;
}
.gantt .handle {
  fill: var(--g-handle-color);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.gantt .handle.active,
.gantt .handle.visible {
  cursor: ew-resize;
  opacity: 1;
}
.gantt .handle.progress {
  fill: var(--g-text-muted);
}
.gantt .bar-wrapper {
  cursor: pointer;
}
.gantt .bar-wrapper .bar {
  outline: 1px solid var(--g-row-border-color);
  border-radius: 3px;
}
.gantt .bar-wrapper:hover .bar {
  transition: transform 0.3s ease;
}
.gantt .bar-wrapper:hover .date-range-highlight {
  display: block;
}

/* --- Lean Planner simple colors --- */

/* Project bars: light blue */
.gantt-project .bar {
  fill: #bfdbfe !important;
  stroke: #93c5fd !important;
}

/* Task bars: light yellow */
.gantt-task .bar {
  fill: #fef3c7 !important;
  stroke: #fde68a !important;
}

/* Keep labels readable */
.gantt-project .bar-label,
.gantt-task .bar-label {
  fill: #111827 !important;
}

/* --- Disable ALL internal scrolling (scroll should be on the outer wrapper) --- */
.gantt-container {
  overflow: visible !important;   /* THIS is key */
  overflow-x: visible !important;
  overflow-y: visible !important;
}

/* Safety: some builds wrap elements */
.gantt-container .gantt,
.gantt-container .wrapper,
.gantt-container svg {
  overflow: visible !important;
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

