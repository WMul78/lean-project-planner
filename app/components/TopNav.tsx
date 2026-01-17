"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import PlanPill from "@/app/components/PlanPill";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, WorkspaceRole } from "@/app/lib/appContext";

type Tier = "free" | "core" | "pro";

const navItems = [
  { label: "Projects", to: "/projects" },
  { label: "Kanban", to: "/kanban" },
  { label: "Hours", to: "/hours" },
  { label: "Gantt", to: "/gantt" },
  // ✅ Today removed
];

function initialFromEmail(email: string | null | undefined) {
  const e = (email ?? "").trim();
  if (!e) return "U";
  return e[0].toUpperCase();
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const hideNav = pathname === "/" || pathname?.startsWith("/login");

  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  const [tier, setTier] = useState<Tier>("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);

  // user menu dropdown
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // workspace popover
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement | null>(null);

  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    // ✅ Option A: no getUser() → use getSession()
    const { data: sess } = await supabase.auth.getSession();
    const session = sess.session;

    if (!session) {
      setLoggedIn(false);
      setEmail(null);
      setWorkspaceRole("member");
      setWorkspaceName(null);
      setTier("free");
      setBillingStatus(null);
      return;
    }

    setLoggedIn(true);
    setEmail(session.user.email ?? null);

    const ws = await getActiveWorkspace();
    if (ws) {
      setWorkspaceRole(ws.role);
      setWorkspaceName(ws.name ?? null);
    } else {
      setWorkspaceRole("member");
      setWorkspaceName(null);
    }

    const t = await getActiveWorkspaceTier();
    setTier(t as Tier);

    // billingStatus: optional, keep existing logic if you load it elsewhere
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const handler = () => load();
    window.addEventListener("workspace-changed", handler);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("workspace-changed", handler);
    };
  }, [load]);

  // Close menus on outside click / escape
  useEffect(() => {
    if (!userMenuOpen && !mobileOpen && !wsOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileOpen(false);
        setWsOpen(false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;

      if (userMenuRef.current && userMenuRef.current.contains(t)) return;
      if (wsRef.current && wsRef.current.contains(t)) return;
      if (mobilePanelRef.current && mobilePanelRef.current.contains(t)) return;

      setUserMenuOpen(false);
      setWsOpen(false);
      setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen, mobileOpen, wsOpen]);

  const me = useMemo(() => initialFromEmail(email), [email]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (hideNav || !loggedIn) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* LEFT: Brand + Desktop nav */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              // ✅ Mobile: toggle menu under logo
              if (typeof window !== "undefined" && window.innerWidth < 640) {
                setMobileOpen((v) => !v);
                setUserMenuOpen(false);
                setWsOpen(false);
                return;
              }
              // Desktop: go projects
              router.push("/projects");
            }}
            className="font-semibold text-gray-900 truncate"
            aria-label="Go to projects"
          >
            <span className="hidden sm:inline">Improvica</span>
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
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {/* Plan pill (desktop) */}
          <div className="hidden sm:flex items-center">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={workspaceName}
              onClick={() => router.push("/pricing")}
            />
          </div>

          {/* Workspace popover trigger (desktop) */}
          <div className="hidden md:block relative" ref={wsRef}>
            <Button
              variant="outline"
              onClick={() => {
                setWsOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              className="px-3 py-2"
            >
              <span className="max-w-[140px] truncate">
                {workspaceName ? workspaceName : "Workspace"}
              </span>
            </Button>

            {wsOpen ? (
              <div
                className={[
                  "absolute right-0 top-full mt-2 z-50",
                  "w-[320px] max-w-[92vw]",
                  "rounded-2xl border bg-white shadow-lg",
                  "p-3",
                  "max-h-[70vh] overflow-auto",
                ].join(" ")}
              >
                <div className="text-xs text-gray-500 mb-2">Switch workspace</div>
                <WorkspaceSwitcher />
              </div>
            ) : null}
          </div>

          {/* User avatar dropdown (bigger) */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setWsOpen(false);
              }}
              className="h-11 w-11 rounded-full bg-gray-900 text-white text-base font-semibold flex items-center justify-center"
              aria-label="User menu"
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
                    router.push("/account");
                  }}
                >
                  Account
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/pricing");
                  }}
                >
                    Billing
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/invites");
                  }}
                >
                  Users
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          {/* ✅ Mobile 3-dots removed */}
        </div>
      </div>

      {/* MOBILE PANEL (opens under logo) */}
      {mobileOpen ? (
        <div className="sm:hidden border-t bg-white" ref={mobilePanelRef}>
          <div className="px-4 py-3 grid gap-2">
            {navItems.map((it) => (
              <button
                key={it.to}
                className={[
                  "text-left px-3 py-2 rounded-xl border",
                  pathname === it.to ? "bg-gray-50 border-gray-300" : "bg-white border-gray-200",
                ].join(" ")}
                onClick={() => {
                  setMobileOpen(false);
                  router.push(it.to);
                }}
              >
                {it.label}
              </button>
            ))}

            <div className="mt-2 rounded-2xl border p-3">
              <div className="text-xs text-gray-500 mb-2">Workspace</div>
              <WorkspaceSwitcher />
            </div>

            <div className="mt-1">
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
      ) : null}
    </header>
  );
}
