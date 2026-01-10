import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PricingClient from "./PricingClient";

export default async function PricingPage() {
  const cookieStore = await cookies();

  // Some Next.js versions expose getAll(); others may not.
  const allCookies =
    typeof (cookieStore as any).getAll === "function"
      ? (cookieStore as any).getAll()
      : [];

  // Supabase auth cookies often start with "sb-" and include "auth-token"
  const hasSupabaseAuthCookie = allCookies.some(
    (c: { name: string }) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );

  if (!hasSupabaseAuthCookie) {
    redirect("/login?next=/pricing");
  }

  return <PricingClient />;
}
