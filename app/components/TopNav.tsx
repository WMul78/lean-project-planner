"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Button from "@/app/components/Button";
import { getSessionUser, hardResetAuth } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

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
  const pathname = usePathname();

  const hideNav = pathname === "/" || pathname.startsWith("/login");
  if (hideNav) return null;

  const [email, setEmail] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const u = await getSessionUser();
      if (cancelled) return;
      setEmail(u?.email ?? null);
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close menu on outside click / escape
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
        <div className="flex items-center gap-2">
          <NavLink href="/projects" label="Projects" />
          <NavLink href="/kanban" label="Kanban" />
          <NavLink href="/gantt" label="Gantt" />
          <NavLink href="/hours" label="Hours" />
        </div>

  <div className="hidden md:block relative">
    <div className="rounded-xl border px-3 py-2">
      <WorkspaceSwitcher />
    </div>
  </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
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

                <Link
                  href="/settings"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Settings
                </Link>

                <Link
                  href="/settings/billing"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Billing
                </Link>

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
