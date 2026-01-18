"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser } from "@/app/lib/appContext";

// Public routes that should remain accessible when logged out
const PUBLIC_ROUTES = new Set<string>(["/", "/login", "/signup"]);

function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // allow invite accept flow etc if you have it public:
  if (pathname.startsWith("/invite")) return true;
  return false;
}

export default function AuthBoundary() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    // 1) On mount: if not logged in and route is protected -> go login
    (async () => {
      const u = await getSessionUser();
      if (cancelled) return;

      if (!u && !isPublicRoute(pathname)) {
        router.replace("/login");
        router.refresh();
      }
    })();

    // 2) Listen for auth changes: if signed out -> go login
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    router.replace("/login");
    router.refresh();
    return;
  }

  if (event === "SIGNED_IN") {
    // VERY IMPORTANT:
    // forces all server + client components to re-evaluate
    router.refresh();
  }
});

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
