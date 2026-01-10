"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

function CheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-700">
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
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="font-semibold text-gray-900">Lean Project Planner</div>

          <nav className="flex items-center gap-2">
            <Link className="text-sm text-gray-600 hover:text-gray-900" href="/pricing">
              Pricing
            </Link>
            <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
              Login
            </Link>
            <Link href="/pricing">
              <Button variant="primary">Start free trial</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-700">
              <span className="font-medium">Pro plan</span>
              <span className="text-gray-500">14-day free trial • €24 / month</span>
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900">
              Plan, execute and improve — in one calm Lean workspace.
            </h1>

            <p className="mt-4 text-gray-600 leading-relaxed">
              A lightweight Lean project planner with clear progress, time planning and a structured way of working.
              Start free, upgrade when you want full control.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/pricing">
                <Button variant="primary">Start 14-day free trial</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Create free account</Button>
              </Link>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              No credit card messaging? If Lemon Squeeze requires it, keep it honest here.
            </p>

            <ul className="mt-6 grid gap-3">
              <FeatureItem text="Projects, tasks and progress in a clean overview" />
              <FeatureItem text="Time planning & hours logging (for better flow)" />
              <FeatureItem text="Upgrade anytime to unlock advanced features" />
            </ul>
          </div>

          {/* Value card */}
          <div className="border rounded-2xl bg-white shadow-sm p-6">
            <div className="text-sm text-gray-500">What you get with Pro</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">More control, less chaos</div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">Advanced planning</div>
                <div className="mt-1 text-sm text-gray-600">Gantt + hours planning for realistic delivery.</div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">Team-ready</div>
                <div className="mt-1 text-sm text-gray-600">Workspaces, roles and better project oversight.</div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">Lean structure</div>
                <div className="mt-1 text-sm text-gray-600">PDCA / DMAIC structure (expandable over time).</div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Link href="/pricing" className="flex-1">
                <Button variant="primary" className="w-full">
                  See pricing
                </Button>
              </Link>
              <Link href="/login" className="flex-1">
                <Button variant="outline" className="w-full">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-wrap gap-3 justify-between">
          <div>© {new Date().getFullYear()} Lean Project Planner</div>
          <div className="flex gap-3">
            <Link className="hover:text-gray-800" href="/pricing">
              Pricing
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
