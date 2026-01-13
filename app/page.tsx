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

function ScreenshotCard({
  title,
  text,
  src,
}: {
  title: string;
  text: string;
  src: string;
}) {
  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
      <div className="p-5 border-b">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-600">{text}</div>
      </div>
      <div className="p-3">
        <Image
          src={src}
          alt={title}
          width={1400}
          height={900}
          className="w-full h-auto rounded-xl border"
          priority={src.includes("hero")}
        />
      </div>
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
            Most popular
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
                Turn improvement ideas into executed Lean projects.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-7">
                Capture bottom-up proposals, run structured projects, and track real progress with tasks and hours.
                When you’re ready, unlock Lean tools like 5x Why and Ishikawa.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Auth-first: user creates an account before any billing */}
                <Link href="/login">
                  <Button className="w-full sm:w-auto">Create a free workspace</Button>
                </Link>

                <a href="#tour">
                  <Button variant="outline" className="w-full sm:w-auto">
                    See the app
                  </Button>
                </a>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Start free (no payment details) • Installable as an app (PWA) • Cancel anytime
              </div>

              <div className="mt-6">
                <a href="#pricing" className="text-sm text-blue-700 hover:underline">
                  View pricing →
                </a>
              </div>
            </div>

            <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-medium text-gray-900">Preview</div>
                <div className="text-xs text-gray-500">Projects overview</div>
              </div>
              <div className="p-3">
                <Image
                  src="/landing/hero.png"
                  alt="Improvica preview"
                  width={1400}
                  height={900}
                  className="w-full h-auto rounded-xl border"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Why Improvica</h2>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Most tools are built for task tracking. Improvica is built for continuous improvement: proposals → execution → measurable progress.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureItem
            title="Bottom-up proposals"
            text="Let the team propose improvements without turning everyone into a paid ‘seat’. Keep ideas flowing."
          />
          <FeatureItem
            title="Execution + progress"
            text="Projects, tasks, hours and progress views help project leads keep momentum and make progress visible."
          />
          <FeatureItem
            title="Lean tools when you upgrade"
            text="Unlock structured problem solving (5x Why, Ishikawa, Project Charter, VSM, …) for serious CI work."
          />
        </div>
      </section>

      {/* TOUR / SCREENSHOTS */}
      <section id="tour" className="bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Product tour</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            A calm, professional workflow that works great on desktop and mobile.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ScreenshotCard
              title="Projects"
              text="Create proposals, run active projects, and keep ownership clear."
              src="/landing/projects.png"
            />
            <ScreenshotCard
              title="Kanban"
              text="Visualize work by status. Keep stakeholders aligned."
              src="/landing/kanban.png"
            />
            <ScreenshotCard
              title="Hours"
              text="Track hours and progress with minimal friction."
              src="/landing/hours.png"
            />
            <ScreenshotCard
              title="Gantt"
              text="Plan timelines and dependencies for larger improvement initiatives."
              src="/landing/gantt.png"
            />
          </div>
        </div>
      </section>

      {/* WORKSPACE PRICING EXPLANATION (later on purpose) */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Designed for teams</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          In many organizations only a few project leads actively manage improvements, while the broader team contributes ideas and feedback.
          Improvica supports that reality: plans apply to a workspace, so stakeholders can join without paid seats.
        </p>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Pricing</h2>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Plans are per workspace. Create an account first, then you can start a trial or upgrade anytime.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="€0"
            tagline="Try the workflow with real features."
            bullets={[
              "Unlimited proposals",
              "Up to 2 active projects per workspace",
              "Projects, tasks, hours, progress",
              "Invite stakeholders (read-only)",
              "No payment details required",
            ]}
            ctaLabel="Start Free (create account)"
            ctaHref="/login"
          />

          <PriceCard
            name="Core"
            price="€24 / month"
            tagline="Unlimited active projects for a workspace."
            bullets={[
              "Unlimited active projects",
              "Projects + Kanban + Hours + Gantt",
              "Better collaboration for project leads",
              "Cancel anytime",
            ]}
            ctaLabel="Start Core (create account)"
            ctaHref="/login"
            highlight
          />

          <PriceCard
            name="Pro"
            price="€49 / month"
            tagline="Lean tools for continuous improvement teams."
            bullets={[
              "Everything in Core",
              "Lean tools (5x Why, Ishikawa, Project Charter, VSM, …)",
              "Templates and structured analysis",
              "Cancel anytime",
            ]}
            ctaLabel="Start Pro (create account)"
            ctaHref="/login"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Note: You’ll create an account first (Supabase Auth). After that you can start a trial and manage billing via Lemon Squeezy.
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
                No. Plans apply to a workspace. Stakeholders can participate without paid seats.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">Can I cancel anytime?</div>
              <div className="mt-1 text-sm text-gray-600">
                Yes. You can cancel anytime and keep access until the end of the billing period.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">Do I need a credit card to start?</div>
              <div className="mt-1 text-sm text-gray-600">
                Not for Free. For a trial/upgrade you’ll add payment details during checkout.
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-900">What is “installable as an app”?</div>
              <div className="mt-1 text-sm text-gray-600">
                You can install Improvica on mobile and use it like an app (PWA).
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/login">
              <Button className="w-full sm:w-auto">Create a free workspace</Button>
            </Link>
            <Link href="/invites">
              <Button variant="outline" className="w-full sm:w-auto">
                Accept an invite
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
