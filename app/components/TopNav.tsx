// app/components/TopNav.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, WorkspaceRole } from "@/app/lib/appContext";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

type MenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function getInitial(email?: string | null) {
  const c = (email ?? "").trim().charAt(0).toUpperCase();
  return c || "U";
}

function PlanPill({
  tier,
  billingStatus,
  onClick,
}: {
  tier: "free" | "core" | "pro";
  billingStatus: string | null;
  onClick?: () => void;
}) {
  const cls =
    tier === "pro"
      ? "bg-purple-50 text-purple-800 border-purple-200"
      : tier === "core"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  const label = billingStatus ? `${tier} • ${billingStatus}` : tier;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 text-xs border px-3 py-1.5 rounded-full",
        "hover:bg-white transition",
        cls,
      ].join(" ")}
      title="Billing / plan"
    >
      <span className="font-semibold uppercase">{label}</span>
      {tier === "free" ? <span className="text-gray-500">Upgrade</span> : null}
    </button>
  );
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Workspace plan state (NEW)
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  // Mobile nav menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  // Avatar dropdown state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const hideNav = useMemo(() => pathname === "/login", [pathname]);
  const canManageUsers = role === "owner" || role === "admin";

  const loadWorkspaceContext = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    setLoggedIn(!!user);
    setUserEmail(user?.email ?? null);

    if (!user) {
      setRole(null);
      setTier("free");
      setBillingStatus(null);
      return;
    }

    const ws = await getActiveWorkspace();
    setRole(ws?.role ?? null);

    // Effective tier via RPC
    const t = await getActiveWorkspaceTier();
    setTier(t);

    // Optional: billing status for label (active/on_trial/paused/inactive)
    if (ws?.workspaceId) {
      const { data: sub, error } = await supabase
        .from("workspace_subscriptions")
        .select("status")
        .eq("workspace_id", ws.workspaceId)
        .maybeSingle();

      if (error) {
        // If you see this, you likely need an RLS SELECT policy on workspace_subscriptions.
        console.warn("workspace_subscriptions select error:", error);
        setBillingStatus(null);
      } else {
        setBillingStatus((sub as any)?.status ?? null);
      }
    } else {
      setBillingStatus(null);
    }
  }, []);

  useEffect(() => {
    if (hideNav) return;

    loadWorkspaceContext();

    const onWsChanged = () => loadWorkspaceContext();
    window.addEventListener("workspace-changed", onWsChanged);

    const onFocus = () => loadWorkspaceContext();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("workspace-changed", onWsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [hideNav, loadWorkspaceContext]);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on ESC + click outside
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const panel = mobilePanelRef.current;
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [mobileOpen]);

  // Close user menu on ESC + click outside
  useEffect(() => {
    if (!userMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const panel = userMenuRef.current;
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      setUserMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (hideNav || !loggedIn) return null;

  const navItems = [
    { label: "Projects", to: "/projects" },
    { label: "Kanban", to: "/kanban" },
    { label: "Hours", to: "/hours" },
    { label: "Gantt", to: "/gantt" },
  ];

  const userItems: MenuItem[] = [
    { label: "Account", onClick: () => router.push("/account") },
    { label: "Manage users", onClick: () => router.push("/admin/users"), disabled: !canManageUsers },
    { label: "Billing", onClick: () => router.push("/pricing") },
    { label: "Sign out", onClick: signOut, danger: true },
  ];

  const initial = getInitial(userEmail);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* LEFT: Brand + Desktop nav + WorkspaceSwitcher */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="font-semibold text-gray-900 truncate"
            aria-label="Go to projects"
          >
            <span className="hidden sm:inline">Improvica</span>
            <span className="sm:hidden">Improvica</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            {navItems.map((it) => (
              <Button
                key={it.to}
                variant="outline"
                onClick={() => router.push(it.to)}
                className={pathname === it.to ? "border-gray-400" : undefined}
              >
                {it.label}
              </Button>
            ))}
          </div>

          {/* Workspace switcher in TopNav (desktop) */}
          <div className="hidden md:block">
            <WorkspaceSwitcher />
          </div>
        </div>

        {/* RIGHT: plan pill + avatar, mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Desktop plan pill (workspace-based) */}
          <div className="hidden sm:flex items-center">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              onClick={() => router.push("/settings/billing")}
            />
          </div>

          {/* Workspace switcher on mobile (so it’s still reachable) */}
          <div className="md:hidden">
            <WorkspaceSwitcher />
          </div>

          {/* Avatar menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-semibold"
              aria-label="Open user menu"
              aria-expanded={userMenuOpen}
              title={userEmail ?? undefined}
            >
              {initial}
            </button>

            {userMenuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="text-xs text-gray-500">Signed in as</div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {userEmail ?? "User"}
                  </div>
                </div>

                <div className="p-2">
                  {userItems.map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      disabled={it.disabled}
                      onClick={() => {
                        setUserMenuOpen(false);
                        it.onClick();
                      }}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl text-sm transition",
                        it.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50",
                        it.danger ? "text-red-700 hover:bg-red-50" : "text-gray-900",
                      ].join(" ")}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Mobile hamburger */}
          <div className="flex sm:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <span className="block h-0.5 w-5 bg-gray-800 mb-1" />
              <span className="block h-0.5 w-5 bg-gray-800 mb-1" />
              <span className="block h-0.5 w-5 bg-gray-800" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {mobileOpen ? (
        <div className="sm:hidden px-4 pb-4">
          <div
            ref={mobilePanelRef}
            className="mt-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Navigation</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {navItems.map((it) => (
                  <Button
                    key={it.to}
                    variant="outline"
                    onClick={() => router.push(it.to)}
                    className="w-full"
                  >
                    {it.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-3 border-b border-gray-200">
              <div className="text-xs text-gray-500">Workspace</div>
              <div className="mt-2">
                <WorkspaceSwitcher />
              </div>
            </div>

            <div className="p-3">
              <div className="text-xs text-gray-500">Plan</div>
              <div className="mt-2">
                <PlanPill
                  tier={tier}
                  billingStatus={billingStatus}
                  onClick={() => router.push("/pricing")}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
