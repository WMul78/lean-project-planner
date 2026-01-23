"use client";

import { useEffect, useMemo, useState } from "react";
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

  // Push status
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [hasBrowserSubscription, setHasBrowserSubscription] = useState(false);
  const [hasDbSubscription, setHasDbSubscription] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const enabledOnThisDevice = useMemo(() => {
    return (
      pushSupported &&
      permission === "granted" &&
      hasBrowserSubscription &&
      hasDbSubscription
    );
  }, [pushSupported, permission, hasBrowserSubscription, hasDbSubscription]);

  const statusLabel = useMemo(() => {
    if (!pushSupported) return "Not supported on this device/browser";
    if (permission === "denied") return "Blocked in browser settings";
    if (permission === "default") return "Not enabled yet";
    // granted:
    if (enabledOnThisDevice) return "Enabled (this device)";
    if (hasBrowserSubscription && !hasDbSubscription) return "Partially enabled (not saved)";
    if (!hasBrowserSubscription && hasDbSubscription) return "Saved, but not enabled on this device";
    return "Permission granted, but not enabled";
  }, [pushSupported, permission, enabledOnThisDevice, hasBrowserSubscription, hasDbSubscription]);

  const actionLabel = enabledOnThisDevice ? "Disable on this device" : "Enable on this device";




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

      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setPushSupported(supported);
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");

      if (supported) {
        await syncPushState(p.id);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function syncPushState(uid: string) {
    // Browser subscription?
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setHasBrowserSubscription(!!sub);
    } catch {
      setHasBrowserSubscription(false);
    }

    // DB subscription?
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", uid)
      .limit(1);

    if (error) {
      console.warn("syncPushState db error:", error);
      setHasDbSubscription(false);
      return;
    }

    setHasDbSubscription((data ?? []).length > 0);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (saving) return;

    const cleanName = fullName.trim();
    setSaving(true);

    // NOTE: If profiles.updated_at does NOT exist, remove it like you did for projects.
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

  async function enablePush(uid: string) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      alert("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in env vars.");
      return;
    }

    setPushBusy(true);
    try {
      // Ensure SW registered
      const reg = await navigator.serviceWorker.register("/sw.js");

      // Ask permission
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        alert("Notification permission was not granted.");
        return;
      }

      // Subscribe
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
    } finally {
      setPushBusy(false);
      await syncPushState(uid);
    }
  }

  async function disablePush(uid: string) {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;

      if (sub) await sub.unsubscribe();

      if (endpoint) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", uid)
          .eq("endpoint", endpoint);
      } else {
        await supabase.from("push_subscriptions").delete().eq("user_id", uid);
      }
    } finally {
      setPushBusy(false);
      await syncPushState(uid);
    }
  }

  async function testLocalNotification() {
    if (!pushSupported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        alert("No service worker registered.");
        return;
      }
      await reg.showNotification("Test notification", {
        body: "If you see this, notifications + service worker are working on this device.",
        data: { url: "/projects" },
      });
    } catch (e) {
      console.warn(e);
      alert("Could not show notification. Check browser/OS settings.");
    }
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
        <div className="grid gap-3 border rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Push notifications</div>
              <div className="text-xs text-gray-500">
                Receive a notification when a new project chat message is posted (stakeholders only).
              </div>
            </div>

            <Button
              type="button"
              onClick={async () => {
                if (pushBusy) return;
                if (enabledOnThisDevice) await disablePush(profile.id);
                else await enablePush(profile.id);
              }}
              disabled={!pushSupported || pushBusy || permission === "denied"}
              variant={enabledOnThisDevice ? "secondary" : "outline"}
            >
              {pushBusy ? "Working…" : actionLabel}
            </Button>
          </div>

          <div className="text-sm">
            <div className="font-medium text-gray-900">
              Status:{" "}
              {enabledOnThisDevice ? (
                <span className="text-emerald-700">Enabled</span>
              ) : permission === "denied" ? (
                <span className="text-rose-700">Blocked</span>
              ) : !pushSupported ? (
                <span className="text-gray-600">Not supported</span>
              ) : (
                <span className="text-gray-700">Disabled</span>
              )}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              <span className="font-medium">Details:</span> {statusLabel}
              <div className="mt-1">
                Permission: <span className="font-medium">{permission}</span> • This device subscribed:{" "}
                <span className="font-medium">{hasBrowserSubscription ? "yes" : "no"}</span> • Saved in account:{" "}
                <span className="font-medium">{hasDbSubscription ? "yes" : "no"}</span>
              </div>
            </div>

            {permission === "denied" ? (
              <div className="mt-2 text-xs text-amber-700">
                Notifications are blocked in your browser settings. Enable them there first.
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={testLocalNotification} disabled={!pushSupported}>
              Test notification
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => syncPushState(profile.id)}
              disabled={!pushSupported || pushBusy}
            >
              Refresh status
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            Note: “Enabled” requires permission <span className="font-medium">and</span> an active subscription on this device{" "}
            <span className="font-medium">and</span> a saved subscription in your account.
          </div>
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
