// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import Button from "@/app/components/Button";
import PublicHeader from "@/app/components/PublicHeader";
import PublicFooter from "@/app/components/PublicFooter";

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="border rounded-2xl p-5 bg-white shadow-sm">
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
          <div className="mt-2 text-sm text-gray-600 leading-6">{tagline}</div>
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

      {note ? <div className="mt-4 text-xs text-gray-500 leading-5">{note}</div> : null}

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
                Turn improvement ideas into structured, measurable projects.
              </h1>

              <p className="mt-4 text-lg text-gray-600 leading-7">
                Capture ideas from your team, manage improvement projects with clarity, and track progress through
                tasks, hours, and planning. Upgrade to unlock integrated Lean tools for deeper analysis and better
                decision-making.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
                Start free • No payment details required • Installable as an app • Cancel anytime
              </div>

              <div className="mt-6 flex items-center gap-3 flex-wrap">
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
                  alt="Improvica project overview"
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
        <h2 className="text-2xl font-semibold text-gray-900">Built for continuous improvement teams</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          Most project tools are built for generic task management. Improvica is designed for teams that want to move
          from ideas to execution with a clear improvement workflow and measurable progress.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureItem
            title="Bottom-up proposals"
            text="Let employees and stakeholders submit improvement ideas without creating friction. Keep valuable input flowing from the people closest to the work."
          />
          <FeatureItem
            title="Execution with visibility"
            text="Manage projects, tasks, ownership, hours, and progress in one place so improvement work stays clear, active, and accountable."
          />
          <FeatureItem
            title="Embedded Lean tools"
            text="Use built-in Lean analysis tools inside your projects to structure root cause analysis, planning, stakeholder alignment, and learning."
          />
        </div>
      </section>

      {/* TOUR / SCREENSHOTS */}
      <section id="tour" className="bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Product tour</h2>
          <p className="mt-2 text-gray-600 max-w-2xl">
            A calm, professional workflow for project leads, improvement teams, and stakeholders.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ScreenshotCard
              title="Projects"
              text="Create proposals, activate projects, and keep ownership and priorities clear."
              src="/landing/projects.png"
            />
            <ScreenshotCard
              title="Kanban"
              text="Visualize work by status and keep the team aligned on what needs attention."
              src="/landing/kanban.png"
            />
            <ScreenshotCard
              title="Hours"
              text="Log hours with minimal friction and compare planned work with actual effort."
              src="/landing/hours.png"
            />
            <ScreenshotCard
              title="Gantt"
              text="Plan timelines and workload for larger initiatives with a clear visual overview."
              src="/landing/gantt.png"
            />
          </div>
        </div>
      </section>

      {/* WORKSPACE MODEL */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Workspace-based pricing that fits real teams</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          In many organizations, only a few people actively lead improvement projects while the broader team contributes
          ideas, context, and feedback. Improvica supports that structure with workspace-based plans instead of
          per-user pricing.
        </p>
      </section>

      {/* LEAN TOOLS */}
      <section className="bg-blue-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Integrated Lean tools in Pro</h2>
          <p className="mt-2 text-gray-600 max-w-3xl leading-7">
            Pro includes embedded Lean tools that help teams structure analysis, clarify scope, and document learning
            directly inside the project workflow.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Project Charter (DMAIC)",
              "SIPOC",
              "Stakeholder analysis",
              "Measurement plan",
              "5 Whys",
              "Ishikawa",
              "Impact analysis",
              "Lessons learned",
            ].map((tool) => (
              <div
                key={tool}
                className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm"
              >
                {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Pricing</h2>
        <p className="mt-2 text-gray-600 max-w-3xl leading-7">
          Plans apply to a workspace. Start free, and upgrade when your team is ready for more projects and integrated
          Lean tools.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="€0"
            tagline="A practical starting point for small teams and first projects."
            bullets={[
              "Unlimited improvement proposals",
              "Up to 2 active projects per workspace",
              "Projects, tasks, hours, and progress tracking",
              "Invite stakeholders with read-only access",
              "No payment details required",
            ]}
            note="Ideal for testing the workflow and collecting ideas from the team."
            ctaLabel="Start Free"
            ctaHref="/login?mode=signup&next=/projects&plan=free"
          />

          <PriceCard
            name="Core"
            price="€9 / month"
            tagline="For teams that want to manage improvement work professionally."
            bullets={[
              "Unlimited active projects",
              "Projects, Kanban, Hours, and Gantt",
              "Workspace-based access for your team",
              "Instant activation after checkout",
              "Cancel anytime",
            ]}
            note="Best for teams that need structure, visibility, and planning without the Lean analysis toolkit."
            ctaLabel="Start Core"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dcore"
            highlight
          />

          <PriceCard
            name="Pro"
            price="€24 / month"
            tagline="For continuous improvement teams that want embedded Lean methods."
            bullets={[
              "Everything in Core",
              "Project Charter (DMAIC)",
              "SIPOC, Stakeholder analysis, Measurement plan",
              "5 Whys, Ishikawa, and Impact analysis",
              "Lessons learned built into the project workflow",
              "Instant activation after checkout",
              "Cancel anytime",
            ]}
            note="Best for Lean, CI, and Operational Excellence teams that want project execution and analysis in one place."
            ctaLabel="Start Pro"
            ctaHref="/login?mode=signup&next=%2Fsettings%2Fbilling%3Fplan%3Dpro"
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="border rounded-2xl p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">FAQ</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FAQItem
              q="Do we pay per user?"
              a="No. Plans apply to a workspace. This makes it easy to involve stakeholders and contributors without managing separate paid seats."
            />
            <FAQItem
              q="Do I need payment details to get started?"
              a="No. You can create a free workspace without entering payment details. You only add billing information when you choose to upgrade."
            />
            <FAQItem
              q="How do paid plans work?"
              a="Paid plans are activated per workspace. After checkout, access to the selected paid features is enabled immediately."
            />
            <FAQItem
              q="Can I cancel anytime?"
              a="Yes. You can cancel your workspace subscription at any time. Your access continues until the end of the current billing period."
            />
            <FAQItem
              q="What is included in Pro?"
              a="Pro includes embedded Lean tools such as Project Charter (DMAIC), SIPOC, Stakeholder analysis, Measurement plan, 5 Whys, Ishikawa, Impact analysis, and Lessons learned."
            />
            <FAQItem
              q="Can I install it like an app?"
              a="Yes. Improvica is a Progressive Web App, so you can install it on mobile and open it from your home screen like an app."
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

          <div className="mt-6 border-t pt-4 text-sm text-gray-500">
            Questions before you start? Contact{" "}
            <a href="mailto:support@improvica.app" className="text-blue-700 hover:underline">
              support@improvica.app
            </a>
            .
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}