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
            <div className="font-semibold text-gray-900">Lean Project Planner</div>

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
                  Trial starts after signup • Works great as a PWA
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
            <div>© {new Date().getFullYear()} Lean Project Planner</div>
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
