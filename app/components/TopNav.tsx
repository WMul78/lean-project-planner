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

function humanStatus(s: string | null) {
  if (!s) return null;
  switch (s) {
    case "active":
      return "Active";
    case "on_trial":
      return "Trial";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "inactive":
      return null;
    default:
      return s;
  }
}

function PlanPill({
  tier,
  billingStatus,
  workspaceName,
  onClick,
}: {
  tier: "free" | "core" | "pro";
  billingStatus: string | null;
  workspaceName?: string | null;
  onClick?: () => void;
}) {
  const cls =
    tier === "pro"
      ? "bg-purple-50 text-purple-800 border-purple-200"
      : tier === "core"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  const statusLabel = humanStatus(billingStatus);
  const tierLabel = tier.toUpperCase();
  const label = statusLabel ? `${tierLabel} • ${statusLabel}` : tierLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 text-xs border px-3 py-1.5 rounded-full",
        "hover:bg-white transition",
        cls,
      ].join(" ")}
      title={workspaceName ? `Plan for ${workspaceName}` : "Billing / plan"}
    >
      <span className="font-semibold">{label}</span>
      {tier === "free" ? <span className="text-gray-500">Upgrade</span> : null}
    </button>
  );
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [loggedIn, setLoggedIn] = useState(false);
  const [hideNav, setHideNav] = useState(false);

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const canManageUsers = useMemo(
    () => workspaceRole === "owner" || workspaceRole === "admin",
    [workspaceRole]
  );

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
    { label: "Sign out", onClick: async () => { await supabase.auth.signOut(); router.push("/login"); }, danger: true },
  ];

  const initial = getInitial(userEmail);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const isIn = !!sess.session;
    setLoggedIn(isIn);

    // Hide nav on auth pages / public pages if you want
    const p = pathname ?? "";
    setHideNav(p.startsWith("/login") || p.startsWith("/invite") || p.startsWith("/invites"));

    if (!isIn) return;

    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData.user?.email ?? null);

    const ws = await getActiveWorkspace();
    if (ws) {
      setWorkspaceRole(ws.role);
      setWorkspaceName(ws.name ?? null);
    }

    const t = await getActiveWorkspaceTier();
    setTier(t);

    // billingStatus is optional; keep as-is if you already set it elsewhere
    // If you load status from a view/table, keep that logic here.
  }, [pathname]);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // Close menus on outside click / escape
  useEffect(() => {
    if (!userMenuOpen && !mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileOpen(false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userMenuRef.current && userMenuRef.current.contains(t)) return;
      if (mobilePanelRef.current && mobilePanelRef.current.contains(t)) return;
      setUserMenuOpen(false);
      setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen, mobileOpen]);

  if (hideNav || !loggedIn) return null;

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
            {/* Desktop brand */}
            <span className="hidden sm:inline">Improvica</span>

            {/* Mobile brand: compact “I” badge */}
            <span className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
              I
            </span>
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

          {/* Workspace switcher in TopNav (desktop only) */}
          <div className="hidden md:block">
            <WorkspaceSwitcher />
          </div>
        </div>

        {/* RIGHT: plan pill + avatar + mobile menu button */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={workspaceName}
              onClick={() => router.push("/pricing")}
            />
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
                  <div className="text-sm font-medium text-gray-900 truncate">{userEmail ?? "User"}</div>
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

          {/* Mobile menu button: three dots */}
          <div className="flex sm:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="text-gray-800">
                <circle cx="5" cy="10" r="1.6" />
                <circle cx="10" cy="10" r="1.6" />
                <circle cx="15" cy="10" r="1.6" />
              </svg>
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
            {/* Workspace switcher ONLY in the mobile panel (prevents topbar overflow) */}
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
                  workspaceName={workspaceName}
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
