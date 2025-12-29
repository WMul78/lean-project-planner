"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ActionsMenu from "@/app/components/ActionsMenu";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, WorkspaceRole } from "@/app/lib/appContext";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const hideNav = useMemo(() => {
    // Hide navigation on auth pages (prevents clutter and weird redirects).
    return pathname === "/login";
  }, [pathname]);

  const canManageUsers = role === "owner" || role === "admin";

  useEffect(() => {
    if (hideNav) return;

    (async () => {
      // We only show the nav if the user is signed in.
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      setLoggedIn(!!user);

      if (!user) {
        setRole(null);
        return;
      }

      // Load active workspace role to enable/disable admin actions.
      const ws = await getActiveWorkspace();
      setRole(ws?.role ?? null);
    })();
  }, [hideNav]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function navBtn(path: string, label: string) {
    const active = pathname === path;
    return (
      <Button
        variant="outline"
        onClick={() => router.push(path)}
        className={active ? "bg-gray-100 border-gray-400" : ""}
      >
        {label}
      </Button>
    );
  }

  if (hideNav || !loggedIn) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* Left: primary navigation */}
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 hidden sm:block">
            Lean Planner
          </div>
          <div className="flex items-center gap-2">
            {navBtn("/projects", "Projects")}
            {navBtn("/kanban", "Kanban")}
            {navBtn("/hours", "Hours")}
          </div>
        </div>

        {/* Right: actions menu */}
        <div className="flex items-center gap-2">
          <ActionsMenu
            icon="dots"
            items={[
              {
                label: "Account",
                onClick: () => router.push("/account"),
              },
              {
                label: "Manage users",
                onClick: () => router.push("/admin/users"),
                disabled: !canManageUsers,
              },
              {
                label: "Sign out",
                onClick: signOut,
                danger: true,
              },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
