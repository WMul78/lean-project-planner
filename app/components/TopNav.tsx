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

function useOutsideClose(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current) return;
      if (ref.current.contains(t)) return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, ref, onClose]);
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide on public pages
  const hideNav = pathname === "/" || pathname.startsWith("/login");
  if (hideNav) return null;

  // --- user state ---
  const [email, setEmail] = useState<string | null>(null);

  // --- panels/menus ---
  const [userMenuOpen, setUserMenuOpen] = useState(false); // avatar menu (desktop + mobile)
  const [wsMenuOpen, setWsMenuOpen] = useState(false); // desktop workspace dropdown
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false); // panel under "I" logo

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const wsMenuRef = useRef<HTMLDivElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(userMenuOpen, userMenuRef, () => setUserMenuOpen(false));
  useOutsideClose(wsMenuOpen, wsMenuRef, () => setWsMenuOpen(false));
  useOutsideClose(mobilePanelOpen, mobilePanelRef, () => setMobilePanelOpen(false));

  // --- plan pill state ---
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [tier, setTier] = useState<WorkspaceTier>("free");
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
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

      const t = await getActiveWorkspaceTier();
      if (seq !== planLoadSeq.current) return;
      setTier(t);

      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select("status")
        .eq("workspace_id", ws.workspaceId)
        .maybeSingle();

      if (seq !== planLoadSeq.current) return;

      if (error) {
        console.warn("TopNav: load billing status failed:", error.message);
        setBillingStatus(null);
      } else {
        setBillingStatus((data as any)?.status ?? null);
      }
    } catch (e: any) {
      console.warn("TopNav: refreshPlan failed:", e?.message ?? e);
      if (seq === planLoadSeq.current) {
        setWorkspaceName(null);
        setTier("free");
        setBillingStatus(null);
        setWorkspaceRole("member");
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshPlan();
  }, [refreshUser, refreshPlan]);

  useEffect(() => {
    const handler = () => refreshPlan();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [refreshPlan]);

  const me = useMemo(() => initialFromEmail(email), [email]);

  async function handleLogout() {
    await hardResetAuth();
    window.location.href = "/login?logged_out=1";
  }

  return (
    <div className="w-full border-b bg-white fixed top-0 left-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* ===================== Desktop left ===================== */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/projects" className="font-semibold text-slate-800">
            Improvica
          </Link>

          <div className="flex items-center gap-2">
            <NavLink href="/projects" label="Projects" />
            <NavLink href="/kanban" label="Kanban" />
            <NavLink href="/gantt" label="Gantt" />
            <NavLink href="/hours" label="Hours" />
          </div>
        </div>

        {/* ===================== Mobile left: "I" logo ===================== */}
        <div className="md:hidden relative" ref={mobilePanelRef}>
          <button
            type="button"
            onClick={() => setMobilePanelOpen((v) => !v)}
            className="h-11 w-11 rounded-full bg-gray-900 text-white text-base font-semibold flex items-center justify-center"
            aria-label="Open navigation"
            aria-expanded={mobilePanelOpen}
          >
            I
          </button>

          {/* Mobile panel under the I logo */}
          {mobilePanelOpen ? (
            <div className="absolute left-0 top-full mt-2 w-[92vw] max-w-[520px] rounded-2xl border bg-white shadow-lg z-50">
              <div className="p-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <NavLink href="/projects" label="Projects" />
                  <NavLink href="/kanban" label="Kanban" />
                  <NavLink href="/gantt" label="Gantt" />
                  <NavLink href="/hours" label="Hours" />
                </div>

                <div className="rounded-2xl border p-3">
                  <WorkspaceSwitcher />
                </div>

                <div className="text-xs text-slate-500">
                  {workspaceName ? `${workspaceName} (${workspaceRole})` : "No workspace selected"}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ===================== Right side (desktop + mobile) ===================== */}
        <div className="flex items-center gap-2">
          {/* Desktop workspace dropdown */}
          <div className="hidden md:block relative" ref={wsMenuRef}>
            <Button
              variant="outline"
              onClick={() => setWsMenuOpen((v) => !v)}
              aria-expanded={wsMenuOpen}
              aria-label="Workspace menu"
            >
              Workspace
            </Button>

            {wsMenuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[90vw] rounded-2xl border bg-white shadow-lg z-50">
                <div className="p-3 max-h-[70vh] overflow-auto">
                  <WorkspaceSwitcher />
                </div>
              </div>
            ) : null}
          </div>

          {/* Desktop plan pill */}
          <div className="hidden md:block">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={workspaceName}
              onClick={() => router.push("/pricing")}
            />
          </div>

          {/* Mobile: optionally show plan pill (small) */}
          <div className="md:hidden">
            <PlanPill
              tier={tier}
              billingStatus={billingStatus}
              workspaceName={null}
              onClick={() => router.push("/pricing")}
            />
          </div>

          {/* Avatar (settings menu) */}
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
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border bg-white shadow-lg overflow-hidden z-50">
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
                    router.push("/admin/users");
                  }}
                >
                  User Management
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
        </div>
      </div>
    </div>
  );
}
