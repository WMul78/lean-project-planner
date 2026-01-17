"use client";

import React from "react";

export type WorkspaceTier = "free" | "core" | "pro";

function humanStatus(s: string | null | undefined) {
  if (!s) return null;
  switch (s) {
    case "active":
      return "Active";
    case "on_trial":
      return "Trial";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "inactive":
      return null;
    default:
      return s;
  }
}

function pillStyle(tier: WorkspaceTier) {
  if (tier === "pro") return "bg-purple-50 text-purple-800 border-purple-200";
  if (tier === "core") return "bg-blue-50 text-blue-800 border-blue-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default function PlanPill({
  tier,
  billingStatus,
  workspaceName,
  onClick,
}: {
  tier: WorkspaceTier;
  billingStatus?: string | null;
  workspaceName?: string | null;
  onClick?: () => void;
}) {
  const statusLabel = humanStatus(billingStatus ?? null);
  const tierLabel = tier.toUpperCase();
  const label = statusLabel ? `${tierLabel} • ${statusLabel}` : tierLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 text-xs border px-3 py-1.5 rounded-full",
        "hover:bg-white transition",
        pillStyle(tier),
      ].join(" ")}
      title={workspaceName ? `Plan for ${workspaceName}` : "Billing / plan"}
    >
      <span className="font-semibold">{label}</span>
      {tier === "free" ? <span className="text-gray-500">Upgrade</span> : null}
    </button>
  );
}
