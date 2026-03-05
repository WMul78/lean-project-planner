// app/(public)/terms/page.tsx
import Link from "next/link";
import Button from "@/app/components/Button";

export const metadata = {
  title: "Terms of Service • Improvica",
  description: "Terms of Service for Improvica Project Planner (Lean Project Planner).",
};

function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
      <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
      <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 text-sm text-gray-700 leading-7">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  // Keep dates stable and explicit for reviewers.
  const lastUpdated = "March 2026";

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <Background />

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/">
            <Button variant="outline">← Back to home</Button>
          </Link>

          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="cta">Login</Button>
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Improvica Project Planner • Legal
          </div>

          <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
            Terms of Service
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Last updated: <span className="font-medium">{lastUpdated}</span>
          </p>
        </div>

        {/* Content card */}
        <div className="mt-8 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
          <p className="text-sm text-gray-700 leading-7">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Improvica Project Planner
            application (also referred to as &quot;Lean Project Planner&quot;) and related services provided by Improvica
            (&quot;Improvica&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By using the service, you agree
            to these Terms.
          </p>

          <Section title="1. Service description">
            Improvica Project Planner is a workspace-based Software-as-a-Service (SaaS) platform for structured improvement
            project management (e.g., PDCA and DMAIC). The service includes features such as projects, tasks, time tracking,
            planning views (e.g., Gantt), and collaboration.
          </Section>

          <Section title="2. Accounts and access">
            You must provide accurate account information and keep your login credentials secure. You are responsible for all
            activity under your account. You must not share accounts in a way that violates applicable law or these Terms.
          </Section>

          <Section title="3. Workspace model and roles">
            The service is organized by workspaces. Workspace owners/admins control access and permissions for workspace members
            and stakeholders. You are responsible for ensuring that users you invite are authorized to access the workspace data.
          </Section>

          <Section title="4. Acceptable use">
            You may not use the service to break the law, infringe intellectual property rights, upload unlawful content,
            distribute malware, attempt to access data without authorization, or disrupt the service. We may suspend or terminate
            accounts that violate these rules.
          </Section>

          <Section title="5. Subscriptions and billing">
            The service may offer paid subscription plans. Access to paid features is typically enabled immediately after a
            successful payment. Subscriptions are billed on a recurring basis unless cancelled. You can cancel at any time to stop
            future charges (access continues until the end of the billing period).
          </Section>

          <Section title="6. Availability and changes">
            We strive for high availability but do not guarantee uninterrupted service. We may change, update, or discontinue
            parts of the service over time. We may perform maintenance which can temporarily impact availability.
          </Section>

          <Section title="7. User content and data">
            You retain ownership of the content you create in the service. You grant us permission to host, store, and process
            that content solely to operate and improve the service and to provide support when requested.
          </Section>

          <Section title="8. Security">
            We implement reasonable technical and organizational measures to protect user data. No system is 100% secure, and you
            accept that risk when using the service.
          </Section>

          <Section title="9. Disclaimer and limitation of liability">
            The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law,
            Improvica will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of
            profits, revenue, data, or goodwill.
          </Section>

          <Section title="10. Termination">
            You may stop using the service at any time. We may suspend or terminate access if you violate these Terms or if we
            must do so to comply with legal obligations.
          </Section>

          <Section title="11. Changes to these Terms">
            We may update these Terms from time to time. We will publish the updated Terms on this page and update the “Last
            updated” date. Continued use after updates means you accept the updated Terms.
          </Section>

          <Section title="12. Contact">
            For questions about these Terms, contact:{" "}
            <span className="font-medium">support@YOURDOMAIN.com</span>
            <div className="mt-2 text-xs text-gray-500">
              Replace the email address with your real support email before sending to a payment provider.
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-8 text-xs text-gray-500 flex flex-wrap gap-3">
          <Link className="underline hover:text-gray-700" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="underline hover:text-gray-700" href="/refund-policy">
            Refund Policy
          </Link>
          <span>© 2026 Improvica</span>
        </div>
      </div>
    </main>
  );
}