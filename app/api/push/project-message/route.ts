// FILE: app/api/push/project-message/route.ts

import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: any | null;
  old_record: any | null;
};

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // 1) Verify webhook secret from Supabase
    const secret = req.headers.get("x-webhook-secret");
    const expected = mustGetEnv("WEBHOOK_SECRET");
    if (!secret || secret !== expected) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2) Parse payload
    const payload = (await req.json()) as WebhookPayload;

    console.log("push webhook received", {
      type: payload?.type,
      table: payload?.table,
      schema: payload?.schema,
      project_id: payload?.record?.project_id,
      sender: payload?.record?.user_id,
    });

    if (payload.type !== "INSERT") {
      return NextResponse.json({ ok: true, ignored: true, reason: "not insert" });
    }
    if (payload.table !== "project_messages") {
      return NextResponse.json({ ok: true, ignored: true, reason: "wrong table" });
    }

    const msg = payload.record;
    if (!msg?.project_id || !msg?.user_id) {
      return NextResponse.json({ ok: false, error: "Missing project_id/user_id on record" }, { status: 400 });
    }

    const projectId = String(msg.project_id);
    const senderId = String(msg.user_id);
    const body = String(msg.body ?? "");

    // 3) Setup web push (Node runtime)
    const VAPID_SUBJECT = mustGetEnv("VAPID_SUBJECT");
    const VAPID_PUBLIC_KEY = mustGetEnv("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = mustGetEnv("VAPID_PRIVATE_KEY");

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // 4) Supabase admin client (service role)
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey);

    // 5) Fetch project name for nicer notification title
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("id,name")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr) {
      console.warn("Project fetch error:", projErr.message);
    }

    const projectName = project?.name ?? "Project";

    // 6) Option A: stakeholders only (project_members.role='stakeholder')
    const { data: stakeholders, error: stErr } = await sb
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("role", "stakeholder");

    if (stErr) {
      console.error("Stakeholder fetch error:", stErr.message);
      return NextResponse.json({ ok: false, error: stErr.message }, { status: 500 });
    }

    const stakeholderIds = Array.from(new Set((stakeholders ?? []).map((r: any) => String(r.user_id))))
      .filter((uid) => uid && uid !== senderId);

    if (stakeholderIds.length === 0) {
      console.log("push result", { sent: 0, removed: 0, recipients: 0, subs: 0, reason: "no recipients" });
      return NextResponse.json({ ok: true, sent: 0, removed: 0, reason: "no recipients" });
    }

    // 7) Load push subscriptions for those stakeholders
    const { data: subs, error: subErr } = await sb
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", stakeholderIds);

    if (subErr) {
      console.error("Subscription fetch error:", subErr.message);
      return NextResponse.json({ ok: false, error: subErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      console.log("push result", {
        sent: 0,
        removed: 0,
        recipients: stakeholderIds.length,
        subs: 0,
        reason: "no subscriptions",
      });
      return NextResponse.json({ ok: true, sent: 0, removed: 0, reason: "no subscriptions" });
    }

    // 8) Build notification payload
    const notif = {
      title: `New message · ${projectName}`,
      body: body.length > 140 ? body.slice(0, 140) + "…" : body,
      data: {
        url: `/projects/${projectId}`,
        projectId,
      },
    };

    // 9) Send notifications
    let sent = 0;
    let removed = 0;

    for (const s of subs as any[]) {
      const subscription = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription as any, JSON.stringify(notif));
        sent++;
      } catch (e: any) {
        const statusCode = e?.statusCode ?? e?.status;
        const msg = e?.message ?? String(e);

        // 410/404 means subscription expired -> remove it
        if (statusCode === 410 || statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("Push send failed:", { statusCode, msg });
        }
      }
    }

    console.log("push result", {
      sent,
      removed,
      recipients: stakeholderIds.length,
      subs: subs.length,
    });

    return NextResponse.json({ ok: true, sent, removed });
  } catch (e: any) {
    console.error("push endpoint error", e?.message ?? e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
