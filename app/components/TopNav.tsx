"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import PlanPill from "@/app/components/PlanPill"; // als jij PlanPill hebt, anders: pas aan naar jouw pill component

type PlanTier = "free" | "core" | "pro";

type WsMembershipRow = {
  workspace_id: string;
  role: string;
  workspaces?: { name?: string | null } | null;
};

function safeTier(v: any): PlanTier {
  return v === "core" || v === "pro" ? v : "free";
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide TopNav on public/auth pages
  const hideNav = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname === "/" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/pricing")
    );
  }, [pathname]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  // Auth/session
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Workspace/plan context (async, non-blocking)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier>("free");
  const [billingStatus, setBillingStatus] = useState<string>("inactive");

  const navItems = useMemo(
    () => [
      { label: "Projects", to: "/projects" },
      { label: "Kanban", to: "/kanban" },
      { label: "Hours", to: "/hours" },
      { label: "Gantt", to: "/gantt" },
    ],
    []
  );

  const loadSessionFast = useCallback(async () => {
    // ✅ Option A: use getSession() only (no getUser())
    const { data } = await supabase.auth.getSession();
    const sess = data.session;

    if (!sess?.user) {
      setLoggedIn(false);
      setUserEmail(null);
      setUserId(null);
      setWorkspaceName(null);
      setTier("free");
      setBillingStatus("inactive");
      return;
    }

    setLoggedIn(true);
    setUserEmail(sess.user.email ?? null);
    setUserId(sess.user.id);
  }, []);

  const loadWorkspaceContext = useCallback(
    async (uid: string) => {
      // 1) active_workspace_id from profile
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", uid)
        .maybeSingle();

      if (profErr) {
        console.warn("TopNav: profile load failed:", profErr);
        setWorkspaceName(null);
        setTier("free");
        setBillingStatus("inactive");
        return;
      }

      // 2) memberships + workspace name (via embed)
      const { data: mems, error: memErr } = await supabase
        .from("workspace_members")
        .select("workspace_id,role,workspaces(name)")
        .eq("user_id", uid);

      if (memErr) {
        console.warn("TopNav: workspace_members load failed:", memErr);
        setWorkspaceName(null);
        setTier("free");
        setBillingStatus("inactive");
        return;
      }

      const list = (mems ?? []) as WsMembershipRow[];
      if (list.length === 0) {
        setWorkspaceName(null);
        setTier("free");
        setBillingStatus("inactive");
        return;
      }

      const activeId = profile?.active_workspace_id ?? null;
      const active =
        (activeId ? list.find((m) => m.workspace_id === activeId) : null) ?? list[0];

      const activeWorkspaceId = active.workspace_id;
      const name = (active.workspaces?.name ?? "").trim();
      setWorkspaceName(name || null);

      // 3) tier via RPC
      const { data: tierData, error: tierErr } = await supabase.rpc(
        "workspace_effective_tier",
        { p_workspace_id: activeWorkspaceId }
      );

      if (tierErr) {
        console.warn("TopNav: workspace_effective_tier error:", tierErr);
        setTier("free");
      } else {
        setTier(safeTier(tierData));
      }

      // 4) subscription status (for pill details)
      const { data: subRow, error: subErr } = await supabase
        .from("workspace_subscriptions")
        .select("status,tier")
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();

      if (subErr) {
        console.warn("TopNav: workspace_subscriptions load failed:", subErr);
        setBillingStatus("inactive");
      } else {
        setBillingStatus(String(subRow?.status ?? "inactive"));
        // tier in subRow might be null for free workspaces; keep RPC tier as truth
      }
    },
    []
  );

  useEffect(() => {
    // Render nav immediately; load async context after mount
    loadSessionFast();
    const { data: subAuth } = supabase.auth.onAuthStateChange(() => {
      loadSessionFast();
    });

    return () => {
      subAuth.subscription.unsubscribe();
    };
  }, [loadSessionFast]);

  // When we have userId, load workspace context (non-blocking)
  useEffect(() => {
    if (!userId) return;
    loadWorkspaceContext(userId);
  }, [userId, loadWorkspaceContext]);

  // Close mobile on outside click
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!mobileOpen) return;
      const el = mobilePanelRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setMobileOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [mobileOpen]);

  // Close mobile on route change
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (hideNav) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-3">
        {/* Logo: on mobile toggles menu, on desktop navigates */}
        <button
          type="button"
          onClick={() => {
            // Mobile: open panel
            if (typeof window !== "undefined" && window.innerWidth < 640) {
              setMobileOpen((v) => !v);
              return;
            }
            // Desktop: go projects
            router.push("/projects");
          }}
          className="flex items-center gap-2 min-w-0"
          aria-label="Improvica"
        >
          <div className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center font-semibold text-gray-900">
            I
          </div>
          <div className="hidden sm:block min-w-0">
            <div className="font-semibold text-gray-900 leading-tight truncate">
              Improvica
            </div>
            <div className="text-xs text-gray-500 leading-tight truncate">
              Lean Project Planner
            </div>
          </div>
        </button>

        {/* Desktop center: workspace switcher */}
        {loggedIn ? (
          <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1 justify-center">
            <div className="max-w-[360px] w-full">
              <WorkspaceSwitcher />
            </div>
          </div>
        ) : (
          <div className="hidden sm:block flex-1" />
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <>
              {/* Desktop nav buttons */}
              <div className="hidden sm:flex items-center gap-2">
                {navItems.map((it) => (
                  <Button
                    key={it.to}
                    variant="outline"
                    onClick={() => router.push(it.to)}
                  >
                    {it.label}
                  </Button>
                ))}
              </div>

              {/* Plan pill (always visible) */}
              <div className="hidden sm:block">
                <PlanPill
                  tier={tier}
                  billingStatus={billingStatus}
                  workspaceName={workspaceName ?? undefined}
                  onClick={() => router.push("/pricing")}
                />
              </div>

              {/* User bubble */}
              <Link
                href="/account"
                className="h-10 w-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-sm font-semibold text-gray-800"
                aria-label="Account"
              >
                {(userEmail?.[0] ?? "U").toUpperCase()}
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/login")}>
                Login
              </Button>
              <Button onClick={() => router.push("/login?mode=signup&next=/projects")}>
                Sign up
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile panel (opens by clicking logo) */}
      {mobileOpen && loggedIn ? (
        <div className="sm:hidden px-4 pb-4">
          <div
            ref={mobilePanelRef}
            className="mt-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-3 border-b border-gray-200 bg-white">
              <div className="text-xs text-gray-500">Workspace</div>
              <div className="mt-2 max-w-[340px]">
                <WorkspaceSwitcher />
              </div>
            </div>

            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Navigation</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {navItems.map((it) => (
                  <Button
                    key={it.to}
                    variant="outline"
                    onClick={() => {
                      setMobileOpen(false);
                      router.push(it.to);
                    }}
                    className="w-full"
                  >
                    {it.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-3">
              <div className="text-xs text-gray-500">Plan</div>
              <div className="mt-2">
                <PlanPill
                  tier={tier}
                  billingStatus={billingStatus}
                  workspaceName={workspaceName ?? undefined}
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/pricing");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
