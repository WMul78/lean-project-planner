// app/(public)/privacy/page.tsx
import Link from "next/link";
import Button from "@/app/components/Button";

export const metadata = {
  title: "Privacy Policy • Improvica",
  description: "Privacy Policy for Improvica Project Planner (Lean Project Planner).",
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 text-sm text-gray-700 leading-7">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 2026";

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      <Background />

      <div className="relative max-w-3xl mx-auto px-6 py-12">
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

        <div className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-3 py-1 text-xs text-gray-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Improvica Project Planner • Legal
          </div>

          <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Last updated: <span className="font-medium">{lastUpdated}</span>
          </p>
        </div>

        <div className="mt-8 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
          <p className="text-sm text-gray-700 leading-7">
            This Privacy Policy explains how Improvica (“we”, “us”, “our”) collects, uses, and protects personal data when you use
            Improvica Project Planner.
          </p>

          <Section title="1. Who is the data controller? (GDPR)">
            Improvica is the data controller for personal data processed in connection with providing this service.
            <div className="mt-2">
              
            </div>
          </Section>

          <Section title="2. What data we collect">
            We may collect and process:
            <ul className="list-disc pl-5 mt-2">
              <li>
                <span className="font-medium">Account data:</span> email address, name (if provided), authentication identifiers.
              </li>
              <li>
                <span className="font-medium">Workspace content you submit:</span> projects, tasks, time entries, messages and other
                data you choose to store in the app.
              </li>
              <li>
                <span className="font-medium">Technical/usage data:</span> IP address, device and browser information, logs needed
                for security and troubleshooting.
              </li>
              <li>
                <span className="font-medium">Billing data:</span> subscription status and payment metadata handled by payment
                providers (we typically do not store full card data).
              </li>
            </ul>
          </Section>

          <Section title="3. Why we process data (purposes)">
            We process personal data to:
            <ul className="list-disc pl-5 mt-2">
              <li>provide and operate the service (accounts, workspaces, collaboration)</li>
              <li>secure the platform, prevent fraud/abuse, and maintain availability</li>
              <li>provide customer support and respond to requests</li>
              <li>process billing and manage subscriptions</li>
              <li>improve product performance and reliability</li>
            </ul>
          </Section>

          <Section title="4. Legal bases (GDPR)">
            Where GDPR applies, we rely on the following legal bases:
            <ul className="list-disc pl-5 mt-2">
              <li>
                <span className="font-medium">Contract</span> (Art. 6(1)(b)): to provide the service you request (account, workspace,
                app functionality).
              </li>
              <li>
                <span className="font-medium">Legitimate interests</span> (Art. 6(1)(f)): to keep the service secure, prevent abuse,
                and improve reliability.
              </li>
              <li>
                <span className="font-medium">Legal obligation</span> (Art. 6(1)(c)): for accounting/tax requirements when applicable.
              </li>
              <li>
                <span className="font-medium">Consent</span> (Art. 6(1)(a)): only where required (e.g., optional marketing cookies or
                newsletters, if introduced).
              </li>
            </ul>
          </Section>

          <Section title="5. Subprocessors / third-party service providers">
            We use trusted providers to operate the service. Depending on configuration, these may include:
            <ul className="list-disc pl-5 mt-2">
              <li>Hosting/infrastructure providers</li>
              <li>Authentication and database providers</li>
              <li>Email delivery providers (transactional emails)</li>
              <li>Payment providers (subscription and checkout processing)</li>
            </ul>
            <div className="mt-2 text-xs text-gray-500">
              Tip: zodra je live bent, kun je hier concreet “Supabase”, “Vercel”, “Resend”, “Lemon Squeezy” noemen als je dat wilt.
              Payment providers vinden dat vaak juist prettig.
            </div>
          </Section>

          <Section title="6. International data transfers">
            Some service providers may process data outside the European Economic Area (EEA). Where applicable, we rely on
            appropriate safeguards such as Standard Contractual Clauses (SCCs) or other lawful transfer mechanisms.
          </Section>

          <Section title="7. Data retention">
            We keep personal data only as long as necessary for the purposes described above:
            <ul className="list-disc pl-5 mt-2">
              <li>Account and workspace data: retained while the account/workspace is active</li>
              <li>Security logs: retained for a limited period as needed for security and troubleshooting</li>
              <li>Billing records: retained as required by accounting/tax laws</li>
            </ul>
            You may request deletion of your account data (see section 9).
          </Section>

          <Section title="8. Security measures">
            We apply reasonable technical and organizational measures to protect data, such as access controls and encryption in
            transit where supported. No system can guarantee absolute security.
          </Section>

          <Section title="9. Your rights (GDPR/EEA)">
            If GDPR applies, you may have rights including:
            <ul className="list-disc pl-5 mt-2">
              <li>Right of access</li>
              <li>Right to rectification</li>
              <li>Right to erasure (“right to be forgotten”)</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object (especially where we rely on legitimate interests)</li>
              <li>Right to withdraw consent (where consent is the legal basis)</li>
            </ul>
            To exercise your rights, contact: <span className="font-medium">support (at) improvica.app</span>.
          </Section>

          <Section title="10. Complaints">
            If you are in the EEA/UK, you have the right to lodge a complaint with your local data protection authority.
          </Section>

          <Section title="11. Cookies and analytics">
            Improvica Project Planner may use essential cookies/storage required for authentication and security.
            If we introduce optional analytics or marketing cookies, we will update this policy and (where required) request consent.
          </Section>

          <Section title="12. Changes to this policy">
            We may update this policy from time to time. Updates will be posted here with a new “Last updated” date.
          </Section>
        </div>

        <div className="mt-8 text-xs text-gray-500 flex flex-wrap gap-3">
          <Link className="underline hover:text-gray-700" href="/terms">
            Terms of Service
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