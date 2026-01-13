// app/api/webhooks/lemonsqueezy/route.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function verifySignature(rawBody: string, signatureHex: string, secret: string) {
  const signature = Buffer.from(signatureHex ?? "", "hex");
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const hmac = Buffer.from(digest, "hex");
  if (signature.length !== hmac.length) return false;
  return crypto.timingSafeEqual(hmac, signature);
}

// Map Lemon variant -> our tier
function tierFromVariant(variantId: string | null) {
  // TODO: set these env vars in Vercel
  const core = process.env.LEMONSQUEEZY_VARIANT_ID_CORE ?? "";
  const pro = process.env.LEMONSQUEEZY_VARIANT_ID_PRO ?? process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY ?? "";

  if (!variantId) return "free";
  if (variantId === pro) return "pro";
  if (variantId === core) return "core";
  return "pro"; // fallback if you only sell Pro today
}

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json("Missing webhook secret", { status: 500 });
  const rawBody = await request.text();
  const sig = request.headers.get("X-Signature") ?? "";

  if (!verifySignature(rawBody, sig, secret)) {
    return NextResponse.json("Invalid signature", { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload?.meta?.event_name ?? "unknown";
  const subId = payload?.data?.id as string | undefined;
  const attr = payload?.data?.attributes ?? {};

  const custom = attr?.checkout_data?.custom ?? {};
  const workspaceId = custom?.workspace_id as string | undefined;

  const status = String(attr?.status ?? "inactive");
  const lemonCustomerId = attr?.customer_id ? String(attr.customer_id) : null;
  const lemonVariantId = attr?.variant_id ? String(attr.variant_id) : null;

  const tier = tierFromVariant(lemonVariantId);

  const trialEndsAt = attr?.trial_ends_at ? new Date(attr.trial_ends_at).toISOString() : null;
  const currentPeriodEndsAt = attr?.renews_at ? new Date(attr.renews_at).toISOString() : null;
  const endsAt = attr?.ends_at ? new Date(attr.ends_at).toISOString() : null;
  const cancelled = Boolean(attr?.cancelled ?? false);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!workspaceId) {
    // Without workspace_id we cannot assign subscription correctly
    return NextResponse.json("OK", { status: 200 });
  }

  await admin.from("workspace_subscriptions").upsert(
    {
      workspace_id: workspaceId,
      lemon_customer_id: lemonCustomerId,
      lemon_subscription_id: subId ?? null,
      lemon_variant_id: lemonVariantId,
      status,
      tier,
      trial_ends_at: trialEndsAt,
      current_period_ends_at: currentPeriodEndsAt,
      ends_at: endsAt,
      cancelled,
      last_event_name: eventName,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );

  // Optional: also store base plan on workspace (for convenience in UI)
  // Note: only set to paid tiers; don't downgrade automatically here.
  if (status === "active" || status === "on_trial" || status === "paused") {
    await admin.from("workspaces").update({ plan: tier }).eq("id", workspaceId);
  }

  return NextResponse.json("OK", { status: 200 });
}
