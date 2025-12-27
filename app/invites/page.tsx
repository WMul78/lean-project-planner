"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function InvitesPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function accept() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.rpc("accept_workspace_invite", {
      invite_token: token.trim(),
    });

    setLoading(false);

    if (error) return alert(error.message);

    router.push("/projects");
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Invite accepteren</h1>
      <p className="text-sm text-gray-600 mt-2">
        Plak je invite-token hier (later vervangen we dit door een e-mail link).
      </p>

      <div className="mt-4 grid gap-2">
        <input
          className="border rounded-md px-3 py-2"
          placeholder="Invite token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button onClick={accept} disabled={loading}>
          {loading ? "Bezig…" : "Accepteer invite"}
        </Button>
      </div>
    </main>
  );
}
