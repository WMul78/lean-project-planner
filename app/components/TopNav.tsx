// app/components/TopNav.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, WorkspaceRole } from "@/app/lib/appContext";
import ActionsMenu from "@/app/components/ActionsMenu";
import Button from "@/app/components/Button";

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

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

    // Re-evaluate role when workspace changes (or after role updates)
    const onWsChanged = () => loadRole();
    window.addEventListener("workspace-changed", onWsChanged);

    // Optional: refresh role when tab regains focus
    const onFocus = () => loadRole();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("workspace-changed", onWsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [hideNav, loadRole]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (hideNav || !loggedIn) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 hidden sm:block">Lean Planner</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/projects")}>Projects</Button>
            <Button variant="outline" onClick={() => router.push("/kanban")}>Kanban</Button>
            <Button variant="outline" onClick={() => router.push("/hours")}>Hours</Button>
          </div>
        </div>

        <ActionsMenu
          icon="dots"
          items={[
            { label: "Account", onClick: () => router.push("/account") },
            { label: "Manage users", onClick: () => router.push("/admin/users"), disabled: !canManageUsers },
            { label: "Sign out", onClick: signOut, danger: true },
          ]}
        />
      </div>
    </header>
  );
}
