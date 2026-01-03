"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";

type Status = "loading" | "need_login" | "accepted" | "error";

export default function InviteAcceptClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  // Prevent double-run (React strict mode in dev) + allow safe cleanup
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (startedRef.current) return;
      startedRef.current = true;

      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Missing invite token.");
        }
        return;
      }

      // 1) Ensure logged in
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        if (!cancelled) {
          setStatus("error");
          setMessage(userErr.message);
        }
        return;
      }

      if (!userRes.user) {
        if (!cancelled) {
          setStatus("need_login");
          setMessage("Please log in (or create an account) to accept the invitation.");
        }
        return;
      }

      // 2) Accept invite via RPC
      // IMPORTANT: function argument is invite_token (your DB function signature)
      const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invite", {
        invite_token: token,
      });

      if (error) {
        if (!cancelled) {
          setStatus("error");
          // Slightly nicer default mapping for common cases
          const msg =
            error.message?.toLowerCase().includes("invite expired")
              ? "This invitation has expired."
              : error.message;
          setMessage(msg);
        }
        return;
      }

      // workspaceId is UUID returned by the function
      if (!cancelled) {
        setStatus("accepted");
        setMessage("Invitation accepted. Redirecting…");
      }

      // 3) Optional: refresh session state and redirect
      // (Server already sets active_workspace_id if empty, but we can just redirect.)
      setTimeout(() => {
        router.replace("/projects");
      }, 800);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-gray-600">Accepting invitation…</div>
      </main>
    );
  }

  if (status === "need_login") {
    const next = token ? `/invite/accept?token=${encodeURIComponent(token)}` : "/invite/accept";

    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-lg p-6">
          <h1 className="text-xl font-semibold">Accept invitation</h1>
          <p className="mt-2 text-sm text-gray-600">{message}</p>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/login?next=${encodeURIComponent(next)}`)}>
              Go to login
            </Button>
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Cancel
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
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Go to projects
            </Button>
            <Button onClick={() => router.refresh()}>Try again</Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
