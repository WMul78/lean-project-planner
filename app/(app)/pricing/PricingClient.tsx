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
