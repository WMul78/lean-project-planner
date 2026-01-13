// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import Button from "@/app/components/Button";

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="border rounded-2xl p-5 bg-white">
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600 leading-6">{text}</div>
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
}: {
  name: string;
  price: string;
  tagline: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
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
            Recommended
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

      <div className="mt-6">
        <Link href={ctaHref}>
          <Button className="w-full">{ctaLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Improvica • Lean Project Planner
              </div>

              <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
                Pay per workspace — invite your whole team.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-7">
                Run Lean projects with clear structure: projects, tasks, hours and progress.
                Start free. Upgrade when your workspace needs more capacity and Lean tools.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link href="/login">
                  <Button className="w-full sm:w-auto">Create free workspace</Button>
                </Link>

                <a href="#pricing">
                  <Button variant="outline" className="w-full sm:w-auto">
                    View pricing
                  </Button>
                </a>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                No credit card for Free • Works great as a PWA • Cancel anytime
              </div>

              <div className="mt-6 flex gap-3">
                <Link href="/invites">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Accept invite
                  </Button>
                </Link>
              </div>
            </div>

            {/* Optional screenshot placeholder */}
            <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-medium text-gray-900">Overview</div>
                <div className="text-xs text-gray-500">example</div>
              </div>
              <div className="p-3">
                <Image
                  src="/landing/hero.png"
                  alt="Improvica preview"
                  width={1200}
                  height={750}
                  className="w-full h-auto rounded-xl"
                />
              </div>
              <div className="px-4 pb-4 text-xs text-gray-500">
                Tip: place screenshots in <code>/public/landing/</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">How it works</h2>
        <p className="mt-2 text-gray-600 max-w-2xl">
          A workspace is your team or department. Plans are per workspace — not per seat.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureItem
            title="1) Start a workspace"
            text="Create your workspace and start with Free. You can create proposals and a limited number of active projects."
          />
          <FeatureItem
            title="2) Invite the team"
            text="Invite team members as viewers/stakeholders. They can follow progress and propose improvements without needing a paid seat."
          />
          <FeatureItem
            title="3) Upgrade when needed"
            text="Upgrade the workspace to unlock unlimited active projects and advanced features. Pro unlocks Lean tools."
          />
        </div>
      </section>

      {/* VALUE PROP: bottom-up */}
      <section className="bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Built for bottom-up improvement</h2>
          <p className="mt-2 text-gray-600 max-w-3xl leading-7">
            In many teams only a few project leads actively manage projects, while the wider team contributes ideas and feedback.
            Improvica fits that reality: you pay for the workspace plan, while stakeholders can participate without paid accounts.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <FeatureItem title="Proposals first" text="Anyone in the workspace can submit a project proposal to improve processes." />
            <FeatureItem title="Clear ownership" text="Project leads manage active work, priorities and execution." />
            <FeatureItem title="Lean-ready" text="Upgrade to Pro to unlock Lean tools like A3, 5xWhy, Ishikawa and more." />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Workspace pricing</h2>
        <p className="mt-2 text-gray-600 max-w-2xl">
          Pick a plan per workspace. Invite your team. Upgrade or cancel anytime.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="€0"
            tagline="Try the workflow without friction."
            bullets={[
              "Unlimited proposals",
              "Up to 2 active projects per workspace",
              "Projects, tasks, hours, progress",
              "Invite stakeholders (read-only)",
              "No credit card required",
            ]}
            ctaLabel="Create free workspace"
            ctaHref="/login"
          />

          <PriceCard
            name="Core"
            price="€24 / month"
            tagline="For active teams managing real work."
            bullets={[
              "Unlimited active projects",
              "Collaboration in one workspace",
              "Planning & progress views (Projects / Kanban / Hours / Gantt)",
              "Email invites for stakeholders",
              "Priority support (basic)",
            ]}
            ctaLabel="Start Core (trial)"
            ctaHref="/login"
            highlight
          />

          <PriceCard
            name="Pro"
            price="€49 / month"
            tagline="Lean tools + advanced improvement work."
            bullets={[
              "Everything in Core",
              "Lean tools (A3, 5xWhy, Ishikawa, Project Charter, VSM*)",
              "Templates and structured problem solving",
              "Advanced reporting (later)",
              "Best for continuous improvement teams",
            ]}
            ctaLabel="Start Pro (trial)"
            ctaHref="/login"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          *Tools marked “later” can be released gradually. Keep the promise aligned with what’s live today.
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="border rounded-2xl p-6 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">FAQ</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="font-medium text-gray-900">Do we pay per user?</div>
              <div className="mt-1 text-sm text-gray-600">
                No. Plans apply to a workspace. Invite the whole team and use roles like stakeholder/viewer.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">Can I cancel anytime?</div>
              <div className="mt-1 text-sm text-gray-600">
                Yes. You can cancel your workspace subscription at any time and keep access until the end of the billing period.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">What can Free do?</div>
              <div className="mt-1 text-sm text-gray-600">
                Free is meant to be usable: proposals + a limited number of active projects, plus tasks/hours/progress.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">When should we upgrade?</div>
              <div className="mt-1 text-sm text-gray-600">
                Upgrade when your workspace needs more capacity (more active projects) or Lean tools (Pro).
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/login">
              <Button className="w-full sm:w-auto">Create free workspace</Button>
            </Link>
            <Link href="/settings/billing">
              <Button variant="outline" className="w-full sm:w-auto">
                Manage billing (existing users)
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
