import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Log env presence (server logs: Vercel)
  console.log("LEMON ENV", {
    storeId,
    variantId,
    hasKey: Boolean(apiKey),
    appUrl,
  });

console.log("VERCEL", {
  env: process.env.VERCEL_ENV,
  url: process.env.VERCEL_URL,
  git: process.env.VERCEL_GIT_COMMIT_SHA,
});

  if (!apiKey || !storeId || !variantId || !appUrl) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) console.error("supabase.auth.getUser error:", userErr);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${appUrl}/settings/billing?success=1`,
        },
        checkout_data: {
          email: user.email,
          custom: { user_id: user.id },
        },
      },
      relationships: {
       // store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

  console.log("LEMON checkout create payload ids", {
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
    return NextResponse.json(
      { error: "Checkout create failed", lemonStatus: res.status, details: text },
      { status: 500 }
    );
  }

  const json = await res.json();
  return NextResponse.json({ url: json?.data?.attributes?.url }, { status: 200 });
}
