"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { requireUser } from "@/app/lib/appContext";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  // ---- Push notification state ----
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushWorking, setPushWorking] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const user = await requireUser(router);
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Load profile error:", error);
        alert(error.message);
        setLoading(false);
        return;
      }

      const p = data as Profile;
      setProfile(p);
      setFullName(p.full_name ?? "");

      // Push support checks
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setPushSupported(supported);
      setPushPermission(typeof Notification !== "undefined" ? Notification.permission : "default");

      if (supported) {
        await syncPushState(user.id);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (saving) return;

    const cleanName = fullName.trim();

    setSaving(true);

    // NOTE: keep consistent with your DB.
    // If profiles table doesn't have updated_at, remove this field like we did for projects.
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: cleanName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.error("Save profile error:", error);
      alert(error.message);
      return;
    }

    alert("Profile updated.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // -----------------------------
  // Push notification helpers
  // -----------------------------
  async function syncPushState(uid: string) {
    try {
      // 1) Check whether browser has an active subscription
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();

      // 2) Check whether we have at least one DB row
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", uid)
        .limit(1);

      if (error) {
        console.warn("syncPushState db error:", error);
        // If DB fails, fallback to browser subscription state
        setPushEnabled(!!sub);
        return;
      }

      const dbHas = (data ?? []).length > 0;
      // enabled if either exists (keep it forgiving)
      setPushEnabled(!!sub || dbHas);
    } catch (e) {
      console.warn("syncPushState error:", e);
      setPushEnabled(false);
    }
  }

  async function enablePush(uid: string) {
    if (!pushSupported) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      alert("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in environment variables.");
      return;
    }

    setPushWorking(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");

      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        alert("Notification permission was not granted.");
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!p256dh || !auth) {
        alert("Push subscription keys missing.");
        return;
      }

      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: uid,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Save push subscription error:", error);
        alert(error.message);
        return;
      }

      setPushEnabled(true);
    } finally {
      setPushWorking(false);
    }
  }

  async function disablePush(uid: string) {
    if (!pushSupported) {
      setPushEnabled(false);
      return;
    }

    setPushWorking(true);
    try {
      // 1) Unsubscribe in browser
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;

      if (sub) {
        await sub.unsubscribe();
      }

      // 2) Remove from DB
      // If we know endpoint, delete only that device row.
      // Otherwise, delete all rows for the user (safe "off" behavior).
      if (endpoint) {
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", uid)
          .eq("endpoint", endpoint);

        if (error) console.warn("Delete push subscription error:", error);
      } else {
        const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", uid);
        if (error) console.warn("Delete push subscriptions error:", error);
      }

      setPushEnabled(false);
    } finally {
      setPushWorking(false);
    }
  }

  async function togglePush() {
    if (!profile) return;
    if (pushWorking) return;

    if (!pushEnabled) {
      await enablePush(profile.id);
    } else {
      await disablePush(profile.id);
    }

    // resync state afterwards
    await syncPushState(profile.id);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="text-gray-600">Profile not found.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <div className="text-sm text-gray-500">Manage your personal account details</div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <form onSubmit={saveProfile} className="mt-6 grid gap-4">
        {/* Email */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Email</label>
          <input className="border rounded-md px-3 py-2 bg-gray-100 text-gray-700" value={email ?? ""} disabled />
          <div className="text-xs text-gray-500">Email address is managed via authentication settings.</div>
        </div>

        {/* Full name */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Full name</label>
          <input
            className="border rounded-md px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            disabled={saving}
          />
        </div>

        {/* Push notifications */}
        <div className="grid gap-2 border rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Push notifications</div>
              <div className="text-xs text-gray-500">
                Get a notification when a project chat message is posted (browser/PWA).
              </div>
            </div>

            <Button
              type="button"
              variant={pushEnabled ? "secondary" : "outline"}
              onClick={togglePush}
              disabled={!pushSupported || pushWorking}
            >
              {pushWorking ? "Working…" : pushEnabled ? "On" : "Off"}
            </Button>
          </div>

          {!pushSupported ? (
            <div className="text-xs text-gray-500">
              Push notifications are not supported in this browser/device.
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              Permission: <span className="font-medium">{pushPermission}</span>
              {pushPermission === "denied" ? (
                <span className="ml-2">
                  (Enable notifications in your browser settings to turn this on.)
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>

          <Button type="button" variant="outline" onClick={signOut} disabled={saving}>
            Sign out
          </Button>
        </div>
      </form>
    </main>
  );
}
