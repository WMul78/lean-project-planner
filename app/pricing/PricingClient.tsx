"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "owner" | "member" | "stakeholder";
type Plan = "paid" | "free";

type Capability = {
  key: string;
  label: string;
  description?: string;
  access: Record<Plan, Record<Role, boolean>>;
};

type SubRow = {
  status: string;
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

function RoleChip({ role }: { role: Role }) {
  const map: Record<Role, { label: string; cls: string }> = {
    admin: { label: "Admin", cls: "bg-blue-50 text-blue-700 border-blue-100" },
    owner: { label: "Owner", cls: "bg-violet-50 text-violet-700 border-violet-100" },
    member: { label: "Member", cls: "bg-sky-50 text-sky-700 border-sky-100" },
    stakeholder: { label: "Stakeholder", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  };

  const m = map[role];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${m.cls}`}>
      {m.label}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return { text: "Pro (active)", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    case "on_trial":
      return { text: "Pro (trial)", cls: "bg-blue-50 text-blue-800 border-blue-200" };
    case "paused":
      return { text: "Paused", cls: "bg-violet-50 text-violet-800 border-violet-200" };
    case "cancelled":
      return { text: "Cancelled", cls: "bg-rose-50 text-rose-800 border-rose-200" };
    case "expired":
      return { text: "Expired", cls: "bg-gray-50 text-gray-700 border-gray-200" };
    case "inactive":
    default:
      return { text: "Free", cls: "bg-amber-50 text-amber-900 border-amber-200" };
  }
}

export default function PricingClient() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);

  const [sub, setSub] = useState<SubRow | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  // ---- Auth gate (members-only) ----
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        router.replace("/login?next=/pricing");
        return;
      }
      setCheckingSession(false);
    }

    run();

    const { data: subAuth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (!session) {
        router.replace("/login?next=/pricing");
        return;
      }
      setCheckingSession(false);
    });

    return () => {
      cancelled = true;
      subAuth.subscription.unsubscribe();
    };
  }, [router]);

  async function loadSub() {
    setSubLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("status,trial_ends_at,current_period_ends_at,ends_at,cancelled")
        .maybeSingle();

      if (error) console.warn("Load subscription failed:", error);
      setSub((data as any) ?? null);
    } finally {
      setSubLoading(false);
    }
  }

  useEffect(() => {
    // Only load subscription after session gate resolves (prevents unnecessary requests).
    if (checkingSession) return;
    loadSub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingSession]);

  const roles: Role[] = ["admin", "owner", "member", "stakeholder"];

  // Permissions matrix: EXACTLY your setup
  const capabilities: Capability[] = useMemo(
    () => [
      {
        key: "workspace_edit",
        label: "Edit workspace",
        description: "Admin-only on Pro. Disabled for all roles on Free.",
        access: {
          paid: { admin: true, owner: false, member: false, stakeholder: false },
          free: { admin: false, owner: false, member: false, stakeholder: false },
        },
      },
      {
        key: "projects_view",
        label: "View projects",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: true },
          free: { admin: true, owner: true, member: true, stakeholder: true },
        },
      },
      {
        key: "projects_propose",
        label: "Propose projects",
        description: "Create proposals. Editing is Pro-only.",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: true },
          free: { admin: true, owner: true, member: true, stakeholder: true },
        },
      },
      {
        key: "projects_edit",
        label: "Edit projects",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: false },
          free: { admin: false, owner: false, member: false, stakeholder: false },
        },
      },
      {
        key: "tasks_manage",
        label: "Create & edit tasks",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: false },
          free: { admin: false, owner: false, member: false, stakeholder: false },
        },
      },
      {
        key: "hours_add",
        label: "Add hours",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: false },
          free: { admin: false, owner: false, member: false, stakeholder: false },
        },
      },
      {
        key: "kanban_view",
        label: "View Kanban",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: true },
          free: { admin: true, owner: true, member: true, stakeholder: true },
        },
      },
      {
        key: "kanban_edit",
        label: "Edit Kanban",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: false },
          free: { admin: false, owner: false, member: false, stakeholder: false },
        },
      },
      {
        key: "gantt_view",
        label: "View Gantt chart",
        access: {
          paid: { admin: true, owner: true, member: true, stakeholder: true },
          free: { admin: true, owner: true, member: true, stakeholder: true },
        },
      },
    ],
    []
  );

  const status = sub?.status ?? "inactive";
  const isPaid = status === "active" || status === "on_trial" || status === "paused";
  const s = statusBadge(status);

  async function startCheckout() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        router.replace("/login?next=/pricing");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
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
            <Link href="/projects" className="font-semibold text-gray-900">
              Improvica
            </Link>

            <nav className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/projects")}
                className="px-3 py-1.5 text-xs"
              >
                Back to app
              </Button>

              {!isPaid ? (
                <Button
                  variant="cta"
                  disabled={busy}
                  onClick={startCheckout}
                  className="px-3 py-1.5 text-xs"
                >
                  {busy ? "Redirecting…" : "Start trial"}
                </Button>
              ) : null}
            </nav>
          </div>
        </header>

        {/* Content */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-xs text-blue-700 shadow-sm">
              <span className="font-semibold">Pro</span>
              <span>€24 / month</span>
              <span className="text-blue-700/80">• 14-day free trial</span>
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900">
              Pricing, permissions & your plan
            </h1>
            <p className="mt-3 text-gray-600 leading-relaxed">
              Free is ideal for viewing and proposing. Pro unlocks execution features (editing, tasks, hours, Kanban edits)
              based on role — exactly as configured in your app.
            </p>
          </div>

          {/* Current plan + helper */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {/* Current plan card */}
            <div className="md:col-span-2 border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">Current plan</div>
                    <div className="text-sm text-gray-600">Your subscription status for this account.</div>
                  </div>

                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${s.cls}`}>
                    {s.text}
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

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span className="text-gray-600">Access</span>
                      {isPaid ? (
                        <span className="font-medium text-emerald-700">Paid features enabled</span>
                      ) : (
                        <span className="font-medium text-amber-700">Free plan (paid features locked)</span>
                      )}
                    </div>

                    {sub?.cancelled ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
                        This subscription is marked as cancelled.
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isPaid ? (
                    <Button variant="cta" disabled={busy} onClick={startCheckout}>
                      {busy ? "Redirecting…" : "Start 14-day free trial"}
                    </Button>
                  ) : null}

                  <Button variant="outline" onClick={loadSub} disabled={busy}>
                    Refresh status
                  </Button>

                  <Button variant="outline" onClick={() => router.push("/settings/billing")}>
                    Billing settings
                  </Button>
                </div>
              </div>
            </div>

            {/* Tip card */}
            <div className="border border-blue-100 rounded-2xl bg-blue-50/60 p-5">
              <div className="font-semibold text-gray-900">What changes with Pro?</div>
              <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                Free users can view projects, Kanban and Gantt and propose projects.
                Pro unlocks editing, tasks, hours and Kanban updates — role-based.
              </div>

              {!isPaid ? (
                <div className="mt-4">
                  <Button variant="cta" disabled={busy} onClick={startCheckout}>
                    {busy ? "Redirecting…" : "Start trial"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-700">
                  You’re on Pro — enjoy the unlocked features.
                </div>
              )}
            </div>
          </div>

          {/* Pricing cards */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {/* Free */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="text-sm text-gray-500">Free</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">€0</div>
              <div className="mt-1 text-sm text-gray-600">View & propose. No editing.</div>

              <ul className="mt-6 grid gap-2 text-sm text-gray-700">
                <li className="flex items-center justify-between">
                  <span>View projects / Kanban / Gantt</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Propose projects</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Edit projects / tasks / hours</span> <BadgeNo />
                </li>
                <li className="flex items-center justify-between">
                  <span>Edit Kanban</span> <BadgeNo />
                </li>
              </ul>
            </div>

            {/* Pro */}
            <div className="border border-blue-200 rounded-2xl p-6 bg-white shadow-sm ring-1 ring-blue-200">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-blue-700 font-semibold">Pro</div>
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                  Best value
                </div>
              </div>

              <div className="mt-1 text-3xl font-semibold text-gray-900">€24 / month</div>
              <div className="mt-1 text-sm text-gray-600">
                Unlock execution features with role-based control.
              </div>

              <ul className="mt-6 grid gap-2 text-sm text-gray-700">
                <li className="flex items-center justify-between">
                  <span>Editing (Admin/Owner/Member)</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Tasks & hours tracking</span> <BadgeYes />
                </li>
                <li className="flex items-center justify-between">
                  <span>Stakeholders stay view-only</span>{" "}
                  <span className="text-xs text-gray-500">by design</span>
                </li>
              </ul>

              {!isPaid ? (
                <div className="mt-6 grid gap-2">
                  <Button variant="cta" disabled={busy} onClick={startCheckout} className="w-full">
                    {busy ? "Redirecting…" : "Start 14-day free trial"}
                  </Button>
                  <div className="text-xs text-gray-500 text-center">
                    You can manage your plan in{" "}
                    <Link className="underline" href="/settings/billing">
                      Billing settings
                    </Link>
                    .
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  You already have Pro access.
                </div>
              )}
            </div>
          </div>

          {/* Permissions matrix */}
          <div className="mt-12 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50/80 to-white border-b border-gray-200">
              <div className="font-medium text-gray-900">Permissions overview</div>
              <div className="text-sm text-gray-600">Exact access by plan and role.</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-4 border-b border-gray-200 bg-white">Capability</th>
                    <th className="p-4 border-b border-gray-200 bg-blue-50/70" colSpan={4}>
                      Improvica Pro
                    </th>
                    <th className="p-4 border-b border-gray-200 bg-gray-50" colSpan={4}>
                      Improvica Free
                    </th>
                  </tr>
                  <tr className="text-left">
                    <th className="p-4 border-b border-gray-200 bg-white"></th>
                    {roles.map((r) => (
                      <th key={`paid-${r}`} className="p-4 border-b border-gray-200 bg-blue-50/50">
                        <RoleChip role={r} />
                      </th>
                    ))}
                    {roles.map((r) => (
                      <th key={`free-${r}`} className="p-4 border-b border-gray-200 bg-gray-50/70">
                        <RoleChip role={r} />
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {capabilities.map((c) => (
                    <tr key={c.key} className="align-top">
                      <td className="p-4 border-b border-gray-200 bg-white">
                        <div className="font-medium text-gray-900">{c.label}</div>
                        {c.description ? <div className="mt-1 text-xs text-gray-500">{c.description}</div> : null}
                      </td>

                      {roles.map((r) => (
                        <td key={`paid-${c.key}-${r}`} className="p-4 border-b border-gray-200 bg-blue-50/30">
                          {c.access.paid[r] ? <BadgeYes /> : <BadgeNo />}
                        </td>
                      ))}
                      {roles.map((r) => (
                        <td key={`free-${c.key}-${r}`} className="p-4 border-b border-gray-200 bg-gray-50/40">
                          {c.access.free[r] ? <BadgeYes /> : <BadgeNo />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom CTA */}
          {!isPaid ? (
            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-blue-100 rounded-2xl p-6 bg-blue-50/60 shadow-sm">
              <div>
                <div className="font-semibold text-gray-900">Ready to unlock execution?</div>
                <div className="text-sm text-gray-600">Start Pro with a 14-day free trial. €24/month after.</div>
              </div>
              <Button variant="cta" disabled={busy} onClick={startCheckout}>
                {busy ? "Redirecting…" : "Start free trial"}
              </Button>
            </div>
          ) : null}
        </section>

        {/* Footer */}
        <footer className="bg-white/80 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
            <div>© {new Date().getFullYear()} Improvica</div>
            <div className="flex gap-3">
              <Link className="hover:text-gray-800" href="/projects">
                App
              </Link>
              <Link className="hover:text-gray-800" href="/settings/billing">
                Billing settings
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
