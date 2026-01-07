import { Suspense } from "react";
import BillingClient from "./BillingClient";

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto p-6">Loading…</div>}>
      <BillingClient />
    </Suspense>
  );
}
