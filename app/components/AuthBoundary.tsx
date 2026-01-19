"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser } from "@/app/lib/appContext";

// Public routes should NOT be forced to /login
const PUBLIC_ROUTES = new Set<string>(["/", "/login", "/signup"]);

function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/invite")) return true;
  if (pathname.startsWith("/invites")) return true;
  return false;
}

export default function AuthBoundary() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function ensureAuthOnMount() {
      if (isPublicRoute(pathname)) return;

      const user = await getSessionUser();
      if (cancelled) return;

      if (!user) {
        // ✅ Hard redirect avoids App Router refresh loops
        window.location.href = "/login?reason=unauthenticated";
      }
    }

    ensureAuthOnMount();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      const ev = String(event);

      if (ev === "SIGNED_OUT" || ev === "TOKEN_REFRESH_FAILED") {
        if (!isPublicRoute(pathname)) {
          window.location.href = "/login?reason=signed_out";
        }
        return;
      }

      // ✅ Do NOT refresh on SIGNED_IN / USER_UPDATED
      // Pages already load their data, and refresh loops can break the app.
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
