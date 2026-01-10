import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PricingClient from "./PricingClient";

// This is a minimal auth gate. If no Supabase session cookie exists, redirect to login.
// Works for Supabase Auth helpers that set auth cookies (common setup).
export default function PricingPage() {
  const cookieStore = cookies();

  // Supabase typically stores auth in cookies like: sb-<project-ref>-auth-token
  // We'll do a best-effort check: if no "sb-" cookie exists → not logged in.
  const hasSupabaseAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasSupabaseAuthCookie) {
    redirect("/login?next=/pricing");
  }

  return <PricingClient />;
}
