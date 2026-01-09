import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * GET /api/billing/checkout
 * Debug endpoint: shows which deployment/env vars are actually used by this running function.
 * Safe: does NOT return any secrets (only booleans for presence).
 */
export async function GET() {
  return json({
    ok: true,
    debug: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      git: process.env.VERCEL_GIT_COMMIT_SHA ?? null,

      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,

      lemon: {
        storeId: process.env.LEMONSQUEEZY_STORE_ID ?? null,
        variantId: process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY ?? null,
        hasApiKey: Boolean(process.env.LEMONSQUEEZY_API_KEY),
        hasWebhookSecret: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET),
      },

      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    },
  });
}

/**
 * POST /api/billing/checkout
 * Creates Lemon Squeezy checkout for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Server logs (Vercel)
  console.log("LEMON ENV (server)", {
    storeId,
    variantId,
    hasKey: Boolean(apiKey),
    appUrl,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    git: process.env.VERCEL_GIT_COMMIT_SHA,
  });

  if (!apiKey || !storeId || !variantId || !appUrl) {
    return json(
      {
        error: "Missing environment variables",
        missing: {
          LEMONSQUEEZY_API_KEY: !apiKey,
          LEMONSQUEEZY_STORE_ID: !storeId,
          LEMONSQUEEZY_VARIANT_ID_MONTHLY: !variantId,
          NEXT_PUBLIC_APP_URL: !appUrl,
        },
      },
      500
    );
  }

  // Auth: verify the user using the bearer token forwarded from client
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) console.error("supabase.auth.getUser error:", userErr);

  const user = userRes?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${appUrl}/settings/billing?success=1`,
        },
        checkout_data: {
          email: user.email,
          custom: {
            user_id: user.id,
          },
        },
      },
      relationships: {
        // Keep store+variant; if store keeps failing, we can remove store as workaround
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

  console.log("LEMON checkout payload ids", {
    storeId: String(storeId),
    variantId: String(variantId),
  });

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Lemon checkout create failed:", res.status, text);
    return json(
      {
        error: "Checkout create failed",
        lemonStatus: res.status,
        details: text,
      },
      500
    );
  }

  const out = await res.json();
  const url = out?.data?.attributes?.url;

  if (!url) {
    console.error("Lemon response missing checkout url:", out);
    return json({ error: "Checkout URL missing" }, 500);
  }

  return json({ url }, 200);
}
