"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser } from "@/app/lib/appContext";

/**
 * AuthBoundary
 * - Only mount this in protected layout: app/(app)/layout.tsx
 * - Redirects to /login when unauthenticated
 * - Reacts to auth state changes to avoid "stale app state" after relogin
 */

// Public routes should NOT be forced to /login
const PUBLIC_ROUTES = new Set<string>(["/", "/login", "/signup"]);

function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTES.has(pathname)) return true;

  // allow invite acceptance flows if you have them public
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
      // If this is a public route, never redirect
      if (isPublicRoute(pathname)) return;

      const user = await getSessionUser();
      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        router.refresh();
      }
    }

    ensureAuthOnMount();

  const { data } = supabase.auth.onAuthStateChange((event) => {
  const ev = String(event);

  if (ev === "SIGNED_OUT") {
    if (!isPublicRoute(pathname)) {
      router.replace("/login");
      router.refresh();
    }
    return;
  }

  if (ev === "SIGNED_IN" || ev === "USER_UPDATED") {
    router.refresh();
    return;
  }

  // In some versions this exists; treat it as signed out
  if (ev === "TOKEN_REFRESH_FAILED") {
    if (!isPublicRoute(pathname)) {
      router.replace("/login");
      router.refresh();
    }
  }
});


    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
