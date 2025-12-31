// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import Button from "@/app/components/Button";

// Public landing page (root "/") shown before login.
// Screenshots can be placed in /public/landing/*.png
export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Lean Project Planner • Kaizen / PDCA / DMAIC
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
                  <Button className="w-full sm:w-auto">Login / Create account</Button>
                </Link>

                <Link href="/invites">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Accept invite
                  </Button>
                </Link>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                No credit card • Works great as a PWA
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b px-4 py-2 text-xs text-gray-500">
                  Preview
                </div>
                <div className="p-3">
                  <Image
                    src="/landing/projects.png"
                    alt="Lean Planner projects overview screenshot"
                    width={1200}
                    height={750}
                    className="w-full h-auto rounded-xl"
                    priority
                  />
                </div>
              </div>

              {/* Small badges */}
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
          <FeatureCard
            title="Projects"
            desc="Create projects with status, priority, deadlines and owners."
            icon="📌"
          />
          <FeatureCard
            title="Tasks"
            desc="Break down work into actionable tasks and assign them."
            icon="✅"
          />
          <FeatureCard
            title="Kanban"
            desc="Visualize project + task flow and focus on what matters now."
            icon="🧩"
          />
          <FeatureCard
            title="Hours"
            desc="Plan and log time. Track progress based on executed vs planned minutes."
            icon="⏱️"
          />
        </div>
      </section>

      {/* LEAN METHODS */}
      <section className="bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Lean-friendly structure</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Use standard projects today, and expand into PDCA or DMAIC when you need more structure.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <LeanCard
              title="Kaizen mindset"
              bullets={[
                "Small steps, visible progress",
                "Simple status + priorities",
                "Focus on execution and learning",
              ]}
            />
            <LeanCard
              title="PDCA"
              bullets={[
                "Plan → Do → Check → Act",
                "Phase-based structure (optional)",
                "Works well for improvement cycles",
              ]}
            />
            <LeanCard
              title="DMAIC"
              bullets={[
                "Define → Measure → Analyze → Improve → Control",
                "Great for larger problem-solving projects",
                "Expandable with tools like A3 / 5-Why / Ishikawa",
              ]}
            />
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Screenshots</h2>
            <p className="mt-2 text-gray-600">
              Replace the images in <code className="text-gray-800">/public/landing</code> with your own screenshots.
            </p>
          </div>

          <Link href="/login">
            <Button variant="outline">Try the app</Button>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
  <ScreenshotCard
    title="Kanban overview"
    src="/landing/kanban.png"
    alt="Kanban screenshot"
  />
  <ScreenshotCard
    title="Plan hours (week)"
    src="/landing/hours.png"
    alt="Hours planner screenshot"
  />
  <ScreenshotCard
    title="Workspace management"
    src="/landing/workspaces.png"
    alt="Workspaces screenshot"
  />
  <ScreenshotCard
    title="Projects overview"
    src="/landing/projects.png"
    alt="Projects screenshot"
  />
</div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Lean Project Planner
            <div className="text-xs text-gray-400 mt-1">
              Built with Next.js + Supabase • Secure by RLS
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/login">
              <Button>Login</Button>
            </Link>
            <Link href="/invites">
              <Button variant="outline">Accept invite</Button>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white border px-3 py-1 text-xs text-gray-700">
      {children}
    </span>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600 leading-6">{desc}</div>
    </div>
  );
}

function LeanCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="border rounded-2xl p-5 bg-white">
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
    <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">screenshot</div>
      </div>
      <div className="p-3">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={750}
          className="w-full h-auto rounded-xl"
        />
      </div>
    </div>
  );
}
