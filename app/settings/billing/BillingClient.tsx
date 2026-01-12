"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";
import { getActiveWorkspace } from "@/app/lib/appContext";

type WsSubRow = {
  status: string;
  tier: "free" | "core" | "pro";
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  ends_at: string | null;
  cancelled: boolean;
};

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sub, setSub] = useState<WsSubRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      setWorkspaceId(null);
      setSub(null);
      setLoading(false);
      return;
    }
    setWorkspaceId(ws.workspaceId);

    const { data, error } = await supabase
      .from("workspace_subscriptions")
      .select("status,tier,trial_ends_at,current_period_ends_at,ends_at,cancelled")
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();

    if (error) console.error(error);
    setSub((data as any) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (sp.get("success") === "1") load();

    const handler = () => load();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
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

      // checkout API reads active_workspace_id from profile server-side (zoals je route nu is aangepast)
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed");
      if (!json?.url) throw new Error("No checkout URL returned");

      window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const status = sub?.status ?? "inactive";
  const tier = sub?.tier ?? "free";
  const isPaid = tier === "core" || tier === "pro";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Billing</h1>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">Workspace</div>
            <div className="text-sm">{workspaceId ? `${workspaceId.slice(0, 8)}…` : "-"}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-medium">Plan</div>
            <div className="text-sm">{tier}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-medium">Billing status</div>
            <div className="text-sm">{status}</div>
          </div>

          {sub?.trial_ends_at ? (
            <div className="text-sm text-gray-600">
              Trial ends: {new Date(sub.trial_ends_at).toLocaleString()}
            </div>
          ) : null}

          {isPaid ? (
            <div className="text-sm text-green-700">You have access to paid features for this workspace.</div>
          ) : (
            <div className="text-sm text-amber-700">
              This workspace is on the free plan. Some features are locked.
            </div>
          )}

          <div className="text-xs text-gray-500 pt-2">
            Cancel anytime. You keep access until the end of the current billing period.
          </div>
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
