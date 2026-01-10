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
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
      {children}
    </span>
  );
}

function RoleCard({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 bg-white`}>
      <div className={`text-xs font-medium ${accent}`}>{title}</div>
      <div className="mt-1 text-sm text-gray-700">{subtitle}</div>
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
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="font-semibold text-gray-900">Lean Project Planner</div>

          <nav className="flex items-center gap-2">
            <Link className="text-sm text-gray-600 hover:text-gray-900" href="/pricing">
              Pricing
            </Link>
            <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
              Login
            </Link>

            {/* Strong CTA */}
            <Link href="/pricing">
              <Button
                variant="primary"
                className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
              >
                Start free trial
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50/60 to-white">
        <div className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill>Pro • €24 / month</Pill>
              <Pill>14-day free trial</Pill>
              <Pill>Free plan available</Pill>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-gray-900">
              A calm Lean planner for real execution.
            </h1>

            <p className="mt-4 text-gray-600 leading-relaxed">
              Plan your projects, keep tasks flowing, and get visibility with Kanban and Gantt.
              Start free for viewing and proposals — upgrade to unlock editing, tasks and hours tracking.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/pricing">
                <Button
                  variant="primary"
                  className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
                >
                  Start 14-day free trial
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Create free account</Button>
              </Link>
            </div>

            <ul className="mt-7 grid gap-3">
              <FeatureItem text="View projects, Kanban and Gantt on the Free plan" />
              <FeatureItem text="Pro unlocks editing, tasks and hours tracking (role-based)" />
              <FeatureItem text="Stakeholders can stay view-only while you execute" />
            </ul>
          </div>

          {/* Value card */}
          <div className="border rounded-2xl bg-white shadow-sm p-6">
            <div className="text-sm text-gray-500">Why Pro works better</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">Less friction, more flow</div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border p-4 bg-blue-50/50">
                <div className="font-medium text-gray-900">Execution permissions</div>
                <div className="mt-1 text-sm text-gray-600">
                  Owners/Members can edit; Stakeholders can view. Clean and predictable.
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">Kanban + Gantt visibility</div>
                <div className="mt-1 text-sm text-gray-600">
                  Everyone sees progress — only the right roles can change it.
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="font-medium text-gray-900">Hours tracking</div>
                <div className="mt-1 text-sm text-gray-600">
                  Track hours on tasks to make planning realistic and transparent.
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Link href="/pricing" className="flex-1">
                <Button
                  variant="primary"
                  className="w-full bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
                >
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

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">How it works</h2>
        <p className="mt-2 text-gray-600 max-w-2xl">
          Keep it simple: propose → plan → execute → review.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 bg-white">
            <div className="text-xs font-medium text-blue-700">Step 1</div>
            <div className="mt-1 font-semibold text-gray-900">Propose & align</div>
            <div className="mt-2 text-sm text-gray-600">
              Free users can propose projects, and everyone can view the roadmap.
            </div>
          </div>

          <div className="rounded-2xl border p-6 bg-white">
            <div className="text-xs font-medium text-blue-700">Step 2</div>
            <div className="mt-1 font-semibold text-gray-900">Execute in flow</div>
            <div className="mt-2 text-sm text-gray-600">
              With Pro, Owners/Members edit projects, manage tasks and update Kanban.
            </div>
          </div>

          <div className="rounded-2xl border p-6 bg-white">
            <div className="text-xs font-medium text-blue-700">Step 3</div>
            <div className="mt-1 font-semibold text-gray-900">Measure & improve</div>
            <div className="mt-2 text-sm text-gray-600">
              Track hours and progress to learn faster and plan better next time.
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Built for roles</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Not everyone should edit everything. Role-based access keeps collaboration calm.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <RoleCard
              title="Admin"
              subtitle="Paid: can edit workspace and everything else."
              accent="text-blue-700"
            />
            <RoleCard
              title="Owner"
              subtitle="Paid: can edit projects, tasks, Kanban and hours (no workspace edit)."
              accent="text-violet-700"
            />
            <RoleCard
              title="Member"
              subtitle="Paid: can execute and update tasks, Kanban and hours."
              accent="text-sky-700"
            />
            <RoleCard
              title="Stakeholder"
              subtitle="Always view-focused: sees progress and can propose projects."
              accent="text-amber-700"
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border rounded-2xl p-6 bg-white">
            <div>
              <div className="font-semibold text-gray-900">Want editing unlocked for your team?</div>
              <div className="text-sm text-gray-600">Start Pro with 14 days free. €24/month after.</div>
            </div>
            <Link href="/pricing">
              <Button
                variant="primary"
                className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
              >
                Start free trial
              </Button>
            </Link>
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
