"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type SubRow = {
  status: string;
  trial_ends_at: string | null;
};

function pillStyle(kind: "free" | "trial" | "active" | "paused") {
  switch (kind) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "trial":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "paused":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

export default function PlanStatusPill() {
  const router = useRouter();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("user_subscriptions")
        .select("status, trial_ends_at")
        .maybeSingle();

      if (!cancelled) {
        setSub(data ?? null);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const planKind = useMemo(() => {
    if (sub?.status === "active") return "active";
    if (sub?.status === "on_trial") return "trial";
    if (sub?.status === "paused") return "paused";
    return "free";
  }, [sub]);

  async function startTrial() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        router.push("/login?next=/pricing");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!json?.url) throw new Error("No checkout url");

      window.location.href = json.url;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-400">Plan: loading…</div>
    );
  }

  const label =
    planKind === "active"
      ? "Plan: Pro"
      : planKind === "trial"
      ? "Plan: Trial"
      : planKind === "paused"
      ? "Plan: Paused"
      : "Plan: Free";

  return (
  <div className="flex items-center gap-2">
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${pillStyle(
        planKind
      )}`}
    >
      {label}
      {planKind === "trial" && sub?.trial_ends_at ? (
        <span className="ml-1 opacity-70">
          • ends {new Date(sub.trial_ends_at).toLocaleDateString()}
        </span>
      ) : null}
    </div>

    {planKind === "free" ? (
      <Button
        variant="cta"
        disabled={busy}
        onClick={startTrial}
        className="px-3 py-1.5 text-xs"
      >
        Start trial
      </Button>
    ) : null}
  </div>
);
}
