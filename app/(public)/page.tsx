// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import Button from "@/app/components/Button";
import PublicHeader from "@/app/components/PublicHeader";
import PublicFooter from "@/app/components/PublicFooter";

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
  note,
}: {
  name: string;
  price: string;
  tagline: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  note?: string;
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

      {note ? <div className="mt-4 text-xs text-gray-500">{note}</div> : null}

      <div className="mt-6">
        <Link href={ctaHref}>
          <Button className="w-full">{ctaLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="font-semibold text-gray-900">{q}</div>
      <div className="mt-2 text-sm text-gray-600 leading-6">{a}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Public top bar (visible when not logged in) */}
      <PublicHeader />


      {/* HERO */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-12">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Improvica • Lean Project Planner
              </div>

              <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
                Turn improvement ideas into executed projects.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-7">
                Capture bottom-up proposals, run structured projects, and track progress with tasks and hours.
                Upgrade when you’re ready to unlock Lean tools like 5x Why and Ishikawa.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Auth-first: create account before billing */}
                <Link href="/login?mode=signup&next=/projects&plan=free">
                  <Button className="w-full sm:w-auto">Create a free workspace</Button>
                </Link>

                <a href="#tour">
                  <Button variant="outline" className="w-full sm:w-auto">
                    See the app
                  </Button>
                </a>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Start free (no payment details) • Install it like an app (PWA) • Cancel anytime
              </div>

              <div className="mt-6 flex items-center gap-3">
                <a href="#pricing" className="text-sm text-blue-700 hover:underline">
                  View pricing →
                </a>
                <Link href="/login?mode=signin&next=/projects" className="text-sm text-gray-600 hover:text-gray-900">
                  Already have an account?
                </Link>
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
            text="Let the whole team propose improvements. Keep ideas flowing without forcing everyone into a paid account."
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

      {/* WORKSPACE PRICING EXPLANATION */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Designed for teams (without per-user pricing)</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          In many organizations only a few project leads actively manage improvements, while the broader team contributes ideas and feedback.
          Improvica supports that reality: plans apply to a workspace, so stakeholders can join and propose improvements without paid seats.
        </p>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Pricing</h2>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Plans are per workspace. Create an account first, then you can upgrade anytime.
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
            note="Great for evaluating the workflow and collecting proposals."
            ctaLabel="Start Free (create account)"
            ctaHref="/login?mode=signup&next=/projects&plan=free"
          />

          <PriceCard
            name="Core"
            price="€9 / month"
            tagline="Unlimited active projects for a workspace."
            bullets={[
              "Unlimited active projects",
              "Projects + Kanban + Hours + Gantt",
              "For project leads managing real work",
              "Cancel anytime",
            ]}
            note="Best for small teams and startups that want planning without Lean tools."
            ctaLabel="Start Core (create account)"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dcore"
            highlight
          />

          <PriceCard
            name="Pro"
            price="€24 / month"
            tagline="Lean tools for continuous improvement teams."
            bullets={[
              "Everything in Core",
              "Lean tools (5x Why, Ishikawa, Project Charter, VSM, …)",
              "Templates and structured analysis",
              "Export / history (as you release it)",
              "Cancel anytime",
            ]}
            note="Best for CI / Lean teams and Operational Excellence."
            ctaLabel="Start Pro (create account)"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dpro"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="border rounded-2xl p-6 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">FAQ</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FAQItem
              q="Do we pay per user?"
              a="No. Plans apply to a workspace. Invite your whole team and use roles like stakeholder/viewer so they can participate without paid seats."
            />
            <FAQItem
              q="Do I need payment details to start?"
              a="Not for Free. For an upgrade you add payment details during checkout. This keeps the free onboarding frictionless."
            />
            <FAQItem
              q="Can I cancel anytime?"
              a="Yes. You can cancel your workspace subscription anytime and keep access until the end of the current billing period."
            />
            <FAQItem
              q="What does ‘install it like an app’ mean?"
              a="Improvica is a PWA: you can install it on mobile and open it from your home screen like a native app."
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/login?mode=signup&next=/projects">
              <Button className="w-full sm:w-auto">Create a free workspace</Button>
            </Link>
            <Link href="/invites">
              <Button variant="outline" className="w-full sm:w-auto">
                Accept an invite
              </Button>
            </Link>
            <Link href="/login?mode=signin&next=/projects">
              <Button variant="outline" className="w-full sm:w-auto">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
