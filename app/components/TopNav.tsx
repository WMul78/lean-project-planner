// app/components/TopNav.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, WorkspaceRole } from "@/app/lib/appContext";
import ActionsMenu from "@/app/components/ActionsMenu";
import Button from "@/app/components/Button";
import PlanStatusPill from "@/app/components/PlanStatusPill";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const hideNav = useMemo(() => pathname === "/login", [pathname]);
  const canManageUsers = role === "owner" || role === "admin";

  const loadRole = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    setLoggedIn(!!user);

    if (!user) {
      setRole(null);
      return;
    }

    const ws = await getActiveWorkspace();
    setRole(ws?.role ?? null);
  }, []);

  useEffect(() => {
    if (hideNav) return;

    loadRole();

    const onWsChanged = () => loadRole();
    window.addEventListener("workspace-changed", onWsChanged);

    const onFocus = () => loadRole();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("workspace-changed", onWsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [hideNav, loadRole]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on ESC + click outside
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

  const actionsItems = [
    { label: "Account", onClick: () => router.push("/account") },
    { label: "Manage users", onClick: () => router.push("/admin/users"), disabled: !canManageUsers },
    { label: "Billing", onClick: () => router.push("/settings/billing") },
    { label: "Sign out", onClick: signOut, danger: true },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* LEFT: Brand + Desktop Nav */}
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

          {/* Desktop nav buttons */}
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
        </div>

        {/* RIGHT: Desktop Plan + Actions, Mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Desktop: show plan pill + CTA */}
          <div className="hidden sm:flex items-center">
            <PlanStatusPill />
          </div>

          {/* Desktop actions menu */}
          <div className="hidden sm:block">
            <ActionsMenu icon="dots" items={actionsItems} />
          </div>

          {/* Mobile: compact plan indicator + hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            {/* Optional on mobile: you can show pill only, or hide it.
                If too busy, replace with: <div className="text-xs text-gray-500">Free</div>
             */}
            <PlanStatusPill />

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              {/* simple hamburger icon */}
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
              <div className="text-xs text-gray-500">Plan</div>
              <div className="mt-2">
                {/* On mobile we show the full pill/CTA here as well */}
                <PlanStatusPill />
              </div>
            </div>

            <div className="p-3">
              <div className="text-xs text-gray-500">Account</div>
              <div className="mt-2 grid gap-2">
                {actionsItems.map((it) => (
                  <Button
                    key={it.label}
                    variant={it.danger ? "danger" : "outline"}
                    onClick={() => it.onClick()}
                    disabled={it.disabled}
                    className="w-full"
                  >
                    {it.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
