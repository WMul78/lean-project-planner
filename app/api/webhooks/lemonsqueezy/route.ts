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

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
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
  const userId = custom?.user_id as string | undefined;

  const status = String(attr?.status ?? "inactive");
  const lemonCustomerId = attr?.customer_id ? String(attr.customer_id) : null;
  const lemonVariantId = attr?.variant_id ? String(attr.variant_id) : null;

  const trialEndsAt = attr?.trial_ends_at ? new Date(attr.trial_ends_at).toISOString() : null;
  const currentPeriodEndsAt = attr?.renews_at ? new Date(attr.renews_at).toISOString() : null;
  const endsAt = attr?.ends_at ? new Date(attr.ends_at).toISOString() : null;
  const cancelled = Boolean(attr?.cancelled ?? false);

  // Service role: webhook schrijft altijd server-side
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fallback: als userId ontbreekt, kun je later mappen via lemon_customer_id/lemon_subscription_id
  if (!userId && !subId) return NextResponse.json("OK", { status: 200 });

  if (userId) {
    await admin.from("user_subscriptions").upsert(
      {
        user_id: userId,
        lemon_customer_id: lemonCustomerId,
        lemon_subscription_id: subId ?? null,
        lemon_variant_id: lemonVariantId,
        status,
        trial_ends_at: trialEndsAt,
        current_period_ends_at: currentPeriodEndsAt,
        ends_at: endsAt,
        cancelled,
        last_event_name: eventName,
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json("OK", { status: 200 });
}
