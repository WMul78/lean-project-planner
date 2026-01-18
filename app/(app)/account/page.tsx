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

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);

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
          <div className="text-sm text-gray-500">
            Manage your personal account details
          </div>
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
          <input
            className="border rounded-md px-3 py-2 bg-gray-100 text-gray-700"
            value={email ?? ""}
            disabled
          />
          <div className="text-xs text-gray-500">
            Email address is managed via authentication settings.
          </div>
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={signOut}
            disabled={saving}
          >
            Sign out
          </Button>
        </div>
      </form>
    </main>
  );
}
