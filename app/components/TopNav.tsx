"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import PlanPill from "@/app/components/PlanPill";
import { supabase } from "@/lib/supabaseClient";
import {
  getActiveWorkspace,
  getActiveWorkspaceTier,
  getSessionUser,
  hardResetAuth,
  type WorkspaceRole,
  type WorkspaceTier,
} from "@/app/lib/appContext";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className="inline-flex">
      <Button variant={active ? "secondary" : "outline"}>{label}</Button>
    </Link>
  );
}

function initialFromEmail(email: string | null | undefined) {
  const e = (email ?? "").trim();
  if (!e) return "U";
  return e[0].toUpperCase();
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide on public pages
  const hideNav = pathname === "/" || pathname.startsWith("/login");
  if (hideNav) return null;

  // --- user menu ---
  const [email, setEmail] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // --- plan pill state ---
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [tier, setTier] = useState<WorkspaceTier>("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  // Optional: keep role if you want to show it later (not used for PlanPill)
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  // Prevent overlapping loads from racing each other
  const planLoadSeq = useRef(0);

  const refreshUser = useCallback(async () => {
    const u = await getSessionUser();
    setEmail(u?.email ?? null);
  }, []);

  const refreshPlan = useCallback(async () => {
    const seq = ++planLoadSeq.current;

    try {
      const u = await getSessionUser();
      if (!u) {
        // logged out state
        if (seq === planLoadSeq.current) {
          setWorkspaceName(null);
          setTier("free");
          setBillingStatus(null);
          setWorkspaceRole("member");
        }
        return;
      }

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        if (seq === planLoadSeq.current) {
          setWorkspaceName(null);
          setTier("free");
          setBillingStatus(null);
          setWorkspaceRole("member");
        }
        return;
      }

      if (seq !== planLoadSeq.current) return;

      setWorkspaceName(ws.name ?? null);
      setWorkspaceRole(ws.role);

      // Tier (RPC workspace_effective_tier)
      const t = await getActiveWorkspaceTier();
      if (seq !== planLoadSeq.current) return;
      setTier(t);

      // Billing status (from workspace_subscriptions), safe optional
      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select("status")
        .eq("workspace_id", ws.workspaceId)
        .maybeSingle();

      if (seq !== planLoadSeq.current) return;

      if (error) {
        // Don’t break the nav if billing lookup fails
        console.warn("TopNav: load billing status failed:", error.message);
        setBillingStatus(null);
      } else {
        setBillingStatus((data as any)?.status ?? null);
      }
    } catch (e: any) {
      // Fail-safe: never break the app because of the nav
      console.warn("TopNav: refreshPlan failed:", e?.message ?? e);
      if (seq === planLoadSeq.current) {
        setWorkspaceName(null);
        setTier("free");
        setBillingStatus(null);
        setWorkspaceRole("member");
      }
    }
  }, []);

  // Initial load: user + plan
  useEffect(() => {
    refreshUser();
    refreshPlan();
  }, [refreshUser, refreshPlan]);

  // Re-load plan when workspace changes (WorkspaceSwitcher dispatches this)
  useEffect(() => {
    const handler = () => refreshPlan();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [refreshPlan]);

  // Close user menu on outside click / escape
  useEffect(() => {
    if (!userMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userMenuRef.current && userMenuRef.current.contains(t)) return;
      setUserMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen]);

  const me = useMemo(() => initialFromEmail(email), [email]);

  async function handleLogout() {
    await hardResetAuth();
    window.location.href = "/login?logged_out=1";
  }

  return (
    <div className="w-full border-b bg-white fixed top-0 left-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left navigation */}
        <div className="flex items-center gap-2">
          <NavLink href="/projects" label="Projects" />
          <NavLink href="/kanban" label="Kanban" />
          <NavLink href="/gantt" label="Gantt" />
          <NavLink href="/hours" label="Hours" />
        </div>

        {/* Right side: workspace switcher + plan pill + user menu */}
        <div className="flex items-center gap-2">
          {/* Workspace */}
          <div className="hidden md:block rounded-xl border px-3 py-2">
            <WorkspaceSwitcher />
          </div>

          {/* Plan pill */}
          <div className="hidden md:block">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={workspaceName}
              onClick={() => router.push("/pricing")}
            />
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="h-11 w-11 rounded-full bg-gray-900 text-white text-base font-semibold flex items-center justify-center"
              aria-label="User menu"
              title={email ?? "User menu"}
            >
              {me}
            </button>

            {userMenuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border bg-white shadow-lg overflow-hidden z-50">
                <div className="px-3 py-2 text-xs text-gray-500 border-b">
                  {email ?? "Signed in"}
                </div>

                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings");
                  }}
                >
                  Settings
                </button>

                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings/billing");
                  }}
                >
                  Billing
                </button>

                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          {/* Optional: quick logout button if you want (can remove) */}
          <div className="hidden">
            <Button variant="danger" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
