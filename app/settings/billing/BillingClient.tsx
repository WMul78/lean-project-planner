"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";

type SubRow = {
  status: string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  ends_at: string | null;
  cancelled: boolean;
};

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("status,trial_ends_at,current_period_ends_at,ends_at,cancelled")
      .maybeSingle();

    if (error) console.error(error);
    setSub((data as any) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (sp.get("success") === "1") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");

      window.location.href = json.url;
    } catch (e: any) {
      alert(e.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const status = sub?.status ?? "inactive";
  const isPaid = status === "active" || status === "on_trial" || status === "paused";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Billing</h1>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">Plan status</div>
            <div className="text-sm">{status}</div>
          </div>

          {sub?.trial_ends_at && (
            <div className="text-sm text-gray-600">
              Trial ends: {new Date(sub.trial_ends_at).toLocaleString()}
            </div>
          )}

          {isPaid ? (
            <div className="text-sm text-green-700">You have access to paid features.</div>
          ) : (
            <div className="text-sm text-amber-700">
              You are on the free plan. Paid features are locked.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={startCheckout}>
          {busy ? "Redirecting…" : "Upgrade / Start trial"}
        </Button>

        <Button variant="outline" onClick={load} disabled={busy}>
          Refresh status
        </Button>
      </div>
    </div>
  );
}
