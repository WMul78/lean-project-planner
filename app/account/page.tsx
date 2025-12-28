"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { requireUser } from "@/app/lib/appContext";

export default function AccountPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await requireUser(router);
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) console.error(error);

      setFullName((data as any)?.full_name ?? "");
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;

    if (!uid) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", uid);

    setSaving(false);

    if (error) return alert(error.message);
    alert("Naam opgeslagen!");
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Projecten
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <>
          <div className="mt-6">
            <label className="text-sm text-gray-600">Naam</label>
            <input
              className="mt-2 w-full border rounded-md px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Bijv. Jan Jansen"
            />
            <div className="mt-2 text-xs text-gray-400">
              Deze naam wordt gebruikt bij het toewijzen van taken.
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={save} disabled={saving}>
              {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
