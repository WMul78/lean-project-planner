// app/(public)/refund-policy/page.tsx
import Link from "next/link";
import Button from "@/app/components/Button";

export const metadata = {
  title: "Refund Policy • Improvica",
  description: "Refund Policy for Improvica Project Planner (Lean Project Planner).",
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

export default function RefundPolicyPage() {
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
            Refund Policy
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Last updated: <span className="font-medium">{lastUpdated}</span>
          </p>
        </div>

        <div className="mt-8 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
          <p className="text-sm text-gray-700 leading-7">
            This Refund Policy explains how refunds are handled for subscriptions to Improvica Project Planner (Lean Project Planner).
          </p>

          <Section title="1. Subscription service">
            Improvica Project Planner is a Software-as-a-Service (SaaS) product delivered digitally. Access to paid features is
            typically granted immediately after successful payment.
          </Section>

          <Section title="2. No automatic refunds">
            Because the service is delivered instantly, subscription payments are generally <span className="font-semibold">non-refundable</span>,
            unless required by applicable law.
          </Section>

          <Section title="3. Cancellation">
            You can cancel your subscription at any time. After cancellation:
            <ul className="list-disc pl-5 mt-2">
              <li>your plan remains active until the end of the current billing period</li>
              <li>you will not be charged again for the next billing cycle</li>
              <li>paid features may be removed after the billing period ends</li>
            </ul>
          </Section>

          <Section title="4. Exceptional cases">
            We may consider refunds in exceptional situations such as:
            <ul className="list-disc pl-5 mt-2">
              <li>duplicate charges</li>
              <li>billing errors clearly caused by the payment system</li>
            </ul>
            Refund requests should be submitted within <span className="font-medium">14 days</span> of the transaction date.
          </Section>

          <Section title="5. How to request a refund review">
            Email <span className="font-medium">support@YOURDOMAIN.com</span> and include:
            <ul className="list-disc pl-5 mt-2">
              <li>your account email</li>
              <li>transaction date (and invoice/receipt ID if available)</li>
              <li>a short description of the issue</li>
            </ul>
          </Section>

          <Section title="6. Payment providers">
            Payments are processed by third-party payment providers. Refund processing time may depend on your payment method and bank.
          </Section>
        </div>

        <div className="mt-8 text-xs text-gray-500 flex flex-wrap gap-3">
          <Link className="underline hover:text-gray-700" href="/terms">
            Terms of Service
          </Link>
          <Link className="underline hover:text-gray-700" href="/privacy">
            Privacy Policy
          </Link>
          <span>© 2026 Improvica</span>
        </div>
      </div>
    </main>
  );
}