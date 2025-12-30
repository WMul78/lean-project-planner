"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

export default function InviteAcceptPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [status, setStatus] = useState<"loading" | "need_login" | "accepted" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Missing invite token.");
        return;
      }

      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setStatus("need_login");
        setMessage("Please log in (or create an account) to accept the invitation.");
        return;
      }

      const { data, error } = await supabase.rpc("accept_workspace_invite", { p_token: token });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("accepted");
      setMessage("Invitation accepted. Redirecting…");

      // Optional: push user to projects after a short moment
      setTimeout(() => {
        router.replace("/projects");
      }, 800);
    }

    run();
  }, [token, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Accepting invitation…</div>
      </main>
    );
  }

  if (status === "need_login") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-lg p-6">
          <h1 className="text-xl font-semibold">Accept invitation</h1>
          <p className="mt-2 text-sm text-gray-600">{message}</p>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`)}>
              Go to login
            </Button>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Login / Sign up
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-gray-700">{message}</p>

        {status === "error" ? (
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Go to projects
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
