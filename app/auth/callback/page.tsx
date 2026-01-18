"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
  supabase.auth.getSession().then(() => {
    window.location.replace("/projects");
  });
}, []);

  return <p>Confirming your account…</p>;
}
