import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Plan = "core" | "pro";

function pickPlan(v: any): Plan {
  return v === "core" ? "core" : "pro";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  // New env vars (set these in Vercel + local)
  const variantCore = process.env.LEMONSQUEEZY_VARIANT_ID_CORE;
  const variantPro = process.env.LEMONSQUEEZY_VARIANT_ID_PRO;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !storeId || !variantCore || !variantPro || !appUrl) {
    return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = pickPlan(body?.plan);

  const variantId = plan === "core" ? variantCore : variantPro;

  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) console.error("supabase.auth.getUser error:", userErr);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Read active workspace from profile (auth user context)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    console.error("profiles select error:", profErr);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  const workspaceId = profile?.active_workspace_id as string | null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace selected" }, { status: 400 });
  }

  // Optional (recommended): ensure the user is actually a member of that workspace
  const { data: wm, error: wmErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (wmErr) console.error("workspace_members check error:", wmErr);
  if (!wm) return NextResponse.json({ error: "Not a member of active workspace" }, { status: 403 });

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${appUrl}/settings/billing?success=1&plan=${plan}`,
        },
        checkout_data: {
          email: user.email,
          // IMPORTANT: include workspace_id so webhook can attach subscription to workspace
          custom: { user_id: user.id, workspace_id: workspaceId, plan },
        },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

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
