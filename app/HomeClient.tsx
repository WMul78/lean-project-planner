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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="mt-2 text-gray-600 max-w-2xl">{subtitle}</p> : null}
    </div>
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
    <div className="rounded-2xl border border-gray-200 p-5 bg-white shadow-sm">
      <div className={`text-xs font-semibold ${accent}`}>{title}</div>
      <div className="mt-2 text-sm text-gray-700 leading-relaxed">{subtitle}</div>
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
        {/* soft blobs */}
        <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
        <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
        {/* subtle grid */}
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
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/pricing">
                Pricing
              </Link>
              <Link className="text-sm text-gray-600 hover:text-gray-900" href="/login">
                Login
              </Link>
              <Link href="/pricing">
                <Button variant="cta">Start free trial</Button>
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill>Pro • €24 / month</Pill>
              <Pill>14-day free trial</Pill>
              <Pill>Free plan available</Pill>
            </div>

            <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
              A calm Lean planner for real execution.
            </h1>

            <p className="mt-4 text-gray-600 leading-relaxed text-base">
              Plan your projects, keep tasks flowing, and get visibility with Kanban and Gantt.
              Start free for viewing and proposals — upgrade to unlock editing, tasks and hours tracking.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/pricing">
                <Button variant="cta">Start 14-day free trial</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Create free account</Button>
              </Link>
            </div>

            <ul className="mt-8 grid gap-3">
              <FeatureItem text="Free: view projects, Kanban and Gantt + propose projects" />
              <FeatureItem text="Pro: unlock editing, tasks, hours and Kanban updates (role-based)" />
              <FeatureItem text="Stakeholders stay view-only while Owners/Members execute" />
            </ul>
          </div>

          {/* Value card */}
          <div className="border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
            <div className="text-sm text-gray-500">Why Pro works better</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">Less friction, more flow</div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="font-medium text-gray-900">Execution permissions</div>
                <div className="mt-1 text-sm text-gray-600">
                  Owners/Members can edit; Stakeholders can view. Clean and predictable.
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="font-medium text-gray-900">Kanban + Gantt visibility</div>
                <div className="mt-1 text-sm text-gray-600">
                  Everyone sees progress — only the right roles can change it.
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="font-medium text-gray-900">Hours tracking</div>
                <div className="mt-1 text-sm text-gray-600">
                  Track hours on tasks to make planning realistic and transparent.
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Link href="/pricing" className="flex-1">
                <Button variant="cta" className="w-full">
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
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <SectionTitle
            title="How it works"
            subtitle="Keep it simple: propose → plan → execute → review."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
              <div className="text-xs font-semibold text-blue-700">Step 1</div>
              <div className="mt-1 font-semibold text-gray-900">Propose & align</div>
              <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                Free users can propose projects. Everyone can view projects, Kanban and Gantt.
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
              <div className="text-xs font-semibold text-blue-700">Step 2</div>
              <div className="mt-1 font-semibold text-gray-900">Execute in flow</div>
              <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                With Pro, Owners/Members/Admin can edit projects, manage tasks and update Kanban.
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
              <div className="text-xs font-semibold text-blue-700">Step 3</div>
              <div className="mt-1 font-semibold text-gray-900">Measure & improve</div>
              <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                Track hours to learn faster and plan more realistically next time.
              </div>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="bg-white/60 border-y border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <SectionTitle
              title="Built for roles"
              subtitle="Not everyone should edit everything. Role-based access keeps collaboration calm."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <RoleCard
                title="Admin"
                subtitle="Paid: can edit workspace + everything else."
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
                subtitle="Always view-focused: can view everything and propose projects."
                accent="text-amber-700"
              />
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-blue-100 rounded-2xl p-6 bg-blue-50/50">
              <div>
                <div className="font-semibold text-gray-900">Want editing unlocked for your team?</div>
                <div className="text-sm text-gray-600">
                  Start Pro with 14 days free. €24/month after.
                </div>
              </div>
              <Link href="/pricing">
                <Button variant="cta">Start free trial</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white/80 border-t border-gray-200">
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
      </div>
    </main>
  );
}
