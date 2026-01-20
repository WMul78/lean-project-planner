import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // IMPORTANT: force Node runtime on Vercel

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: any;
  old_record: any;
};

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // 1) Verify secret from Supabase webhook
    const secret = req.headers.get("x-webhook-secret");
    const expected = mustGetEnv("WEBHOOK_SECRET");
    if (!secret || secret !== expected) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = (await req.json()) as WebhookPayload;

    if (payload.type !== "INSERT") return NextResponse.json({ ok: true, ignored: true });
    if (payload.table !== "project_messages") return NextResponse.json({ ok: true, ignored: true });

    // 2) Setup web-push (Node)
    const VAPID_SUBJECT = mustGetEnv("VAPID_SUBJECT");
    const VAPID_PUBLIC_KEY = mustGetEnv("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = mustGetEnv("VAPID_PRIVATE_KEY");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // 3) Supabase admin client (service role) to read stakeholders/subscriptions
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey);

    const msg = payload.record;
    const projectId = msg.project_id as string;
    const senderId = msg.user_id as string;
    const body = (msg.body ?? "") as string;

    // Project name for title
    const { data: project } = await sb
      .from("projects")
      .select("id,name")
      .eq("id", projectId)
      .maybeSingle();

    const projectName = project?.name ?? "Project";

    // 4) Stakeholders only (A): project_members.role='stakeholder'
    const { data: stakeholders, error: stErr } = await sb
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("role", "stakeholder");

    if (stErr) return NextResponse.json({ ok: false, error: stErr.message }, { status: 500 });

    const stakeholderIds = Array.from(new Set((stakeholders ?? []).map((r: any) => r.user_id as string)))
      .filter((uid) => uid !== senderId);

    if (stakeholderIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no recipients" });
    }

    const { data: subs, error: subErr } = await sb
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", stakeholderIds);

    if (subErr) return NextResponse.json({ ok: false, error: subErr.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "no subscriptions" });

    const notif = {
      title: `New message · ${projectName}`,
      body: body.length > 140 ? body.slice(0, 140) + "…" : body,
      data: { url: `/projects/${projectId}`, projectId },
    };

    let sent = 0;
    let removed = 0;

    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(notif)
        );
        sent++;
      } catch (e: any) {
        const statusCode = e?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("Push send failed:", statusCode, e?.message ?? e);
        }
      }
    }

    return NextResponse.json({ ok: true, sent, removed });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
