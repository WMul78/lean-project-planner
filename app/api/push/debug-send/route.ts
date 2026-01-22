import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // Simple protection so random people can't send pushes
    const expectedSecret = mustEnv("WEBHOOK_SECRET");
    const gotSecret = req.headers.get("x-webhook-secret") || "";
    if (gotSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { user_id, title, body, url } = (await req.json()) as {
      user_id: string;
      title?: string;
      body?: string;
      url?: string;
    };

    if (!user_id) {
      return NextResponse.json({ ok: false, error: "Missing user_id" }, { status: 400 });
    }

    // Configure VAPID
    const VAPID_SUBJECT = mustEnv("VAPID_SUBJECT");
    const VAPID_PUBLIC_KEY = mustEnv("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = mustEnv("VAPID_PRIVATE_KEY");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Supabase admin
    const SUPABASE_URL = mustEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Load subscriptions for this user
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,user_agent")
      .eq("user_id", user_id);

    if (subsErr) {
      return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, removed: 0, reason: "no subscriptions" });
    }

    const payload = JSON.stringify({
      title: title ?? "Debug push",
      body: body ?? "This is a test push sent from /api/push/debug-send",
      data: { url: url ?? "/projects" },
    });

    let sent = 0;
    let removed = 0;

    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          } as any,
          payload
        );
        sent++;
      } catch (e: any) {
        const status = e?.statusCode ?? e?.status;
        const msg = e?.message ?? String(e);

        // Expired subscription => delete
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("debug push send failed:", { status, msg, user_agent: s.user_agent });
        }
      }
    }

    console.log("debug push result", { user_id, sent, removed, subs: subs.length });

    return NextResponse.json({ ok: true, sent, removed, subs: subs.length });
  } catch (e: any) {
    console.error("debug-send error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
