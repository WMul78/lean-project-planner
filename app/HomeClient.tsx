"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

function CheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-700 border border-blue-100">
      ✓
    </span>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5">
        <CheckIcon />
      </span>
      <span className="text-sm text-gray-700">{text}</span>
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow-sm">
      {children}
    </span>
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
            <Link href="/" className="font-semibold text-gray-900">
              Lean Project Planner
            </Link>

            <nav className="flex items-center gap-3">
              {/* Pricing is "members-only" → route through login */}
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login?next=/pricing">
                Pricing
              </Link>
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
                Login
              </Link>

              {/* Primary CTA: register */}
              <Link href="/login?mode=signup">
                <Button variant="cta">Create free account</Button>
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill>Free plan available</Pill>
              <Pill>Pro • €24 / month</Pill>
              <Pill>14-day free trial (after signup)</Pill>
            </div>

            <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
              A calm Lean planner for real execution.
            </h1>

            <p className="mt-4 text-gray-600 leading-relaxed text-base">
              Start by creating a free account. You can view projects, Kanban and Gantt and propose projects.
              When you’re ready to execute (edit tasks, update Kanban, track hours), upgrade to Pro.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login?mode=signup">
                <Button variant="cta">Create free account</Button>
              </Link>

              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
            </div>

            <ul className="mt-8 grid gap-3">
              <FeatureItem text="Create a free account in 1 minute" />
              <FeatureItem text="Free: view projects, Kanban and Gantt + propose projects" />
              <FeatureItem text="Pro (after signup): unlock editing, tasks, hours and Kanban updates (role-based)" />
            </ul>

            <div className="mt-5 text-xs text-gray-500">
              Trial requires an account, so we can connect your subscription to your workspace.
            </div>
          </div>

          {/* Value card */}
          <div className="border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
            <div className="text-sm text-gray-500">Upgrade when you need it</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">Less friction, more flow</div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="font-medium text-gray-900">Free (view + propose)</div>
                <div className="mt-1 text-sm text-gray-600">
                  Great for stakeholders and early alignment.
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="font-medium text-gray-900">Pro (execute)</div>
                <div className="mt-1 text-sm text-gray-600">
                  Owners/Members can edit projects, update Kanban and track hours.
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Link href="/login?mode=signup" className="flex-1">
                <Button variant="cta" className="w-full">
                  Create account
                </Button>
              </Link>
              <Link href="/login?next=/pricing" className="flex-1">
                <Button variant="outline" className="w-full">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white/80 border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
            <div>© {new Date().getFullYear()} Lean Project Planner</div>
            <div className="flex gap-3">
              <Link className="hover:text-gray-800" href="/login?next=/pricing">
                Pricing
              </Link>
              <Link className="hover:text-gray-800" href="/login">
                Login
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
