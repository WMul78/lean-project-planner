"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  feature: string;
  free: string;
  pro: string;
};

function Check() {
  return <span className="text-green-700">✓</span>;
}
function Dash() {
  return <span className="text-gray-400">—</span>;
}

export default function PricingClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const rows: Row[] = useMemo(
    () => [
      { feature: "Projects & tasks", free: "Included", pro: "Included" },
      { feature: "Basic progress overview", free: "Included", pro: "Included" },
      { feature: "Hours planning (week view)", free: "Limited", pro: "Full" },
      { feature: "Gantt view", free: "Limited", pro: "Full" },
      { feature: "Project types (PDCA / DMAIC)", free: "Limited", pro: "Full" },
      { feature: "Advanced collaboration / roles", free: "—", pro: "Included" },
      { feature: "Priority support (later)", free: "—", pro: "Included" },
    ],
    []
  );

  async function startCheckout() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      // Not logged in? send to login, then user can return here.
      if (!token) {
        router.push("/login?next=/pricing");
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

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="font-semibold text-gray-900">
            Lean Project Planner
          </Link>

          <nav className="flex items-center gap-2">
            <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
              Login
            </Link>
            <Button variant="primary" disabled={busy} onClick={startCheckout}>
              {busy ? "Redirecting…" : "Start free trial"}
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Simple pricing.</h1>
          <p className="mt-3 text-gray-600 leading-relaxed">
            Start free. Upgrade to Pro when you want full planning and collaboration features.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {/* Free */}
          <div className="border rounded-2xl p-6 bg-white">
            <div className="text-sm text-gray-500">Free</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">€0</div>
            <div className="mt-1 text-sm text-gray-600">For personal testing and basic usage.</div>

            <ul className="mt-6 grid gap-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <Check /> Projects & tasks
              </li>
              <li className="flex items-center gap-2">
                <Check /> Basic progress overview
              </li>
              <li className="flex items-center gap-2">
                <Dash /> Advanced planning (full)
              </li>
              <li className="flex items-center gap-2">
                <Dash /> Collaboration features (full)
              </li>
            </ul>

            <div className="mt-6">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Create free account
                </Button>
              </Link>
            </div>
          </div>

          {/* Pro */}
          <div className="border rounded-2xl p-6 bg-white shadow-sm ring-1 ring-blue-200">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-blue-700 font-medium">Pro</div>
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                14-day free trial
              </div>
            </div>

            <div className="mt-1 text-3xl font-semibold text-gray-900">€24 / month</div>
            <div className="mt-1 text-sm text-gray-600">
              For serious planning, progress and team-ready workflows.
            </div>

            <ul className="mt-6 grid gap-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <Check /> Everything in Free
              </li>
              <li className="flex items-center gap-2">
                <Check /> Full hours planning (week view)
              </li>
              <li className="flex items-center gap-2">
                <Check /> Full Gantt view
              </li>
              <li className="flex items-center gap-2">
                <Check /> PDCA / DMAIC structure (expandable)
              </li>
              <li className="flex items-center gap-2">
                <Check /> Collaboration / roles (workspace-level)
              </li>
            </ul>

            <div className="mt-6 grid gap-2">
              <Button variant="primary" disabled={busy} onClick={startCheckout} className="w-full">
                {busy ? "Redirecting…" : "Start 14-day free trial"}
              </Button>
              <div className="text-xs text-gray-500 text-center">
                You can manage your plan in <Link className="underline" href="/settings/billing">Billing</Link>.
              </div>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div className="mt-12 border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="font-medium text-gray-900">Compare features</div>
            <div className="text-sm text-gray-600">A quick overview of what’s included.</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-4 border-b">Feature</th>
                  <th className="p-4 border-b">Free</th>
                  <th className="p-4 border-b">Pro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="align-top">
                    <td className="p-4 border-b font-medium text-gray-900">{r.feature}</td>
                    <td className="p-4 border-b text-gray-700">{r.free}</td>
                    <td className="p-4 border-b text-gray-700">{r.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border rounded-2xl p-6 bg-white">
          <div>
            <div className="font-semibold text-gray-900">Ready to run your next improvement project?</div>
            <div className="text-sm text-gray-600">Start Pro with a 14-day free trial. €24/month after.</div>
          </div>
          <Button variant="primary" disabled={busy} onClick={startCheckout}>
            {busy ? "Redirecting…" : "Start free trial"}
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
          <div>© {new Date().getFullYear()} Lean Project Planner</div>
          <div className="flex gap-3">
            <Link className="hover:text-gray-800" href="/">
              Home
            </Link>
            <Link className="hover:text-gray-800" href="/login">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
