"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/app/components/Button";
import { hardResetAuth } from "@/app/lib/appContext";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className="inline-flex">
      <Button variant={active ? "secondary" : "outline"}>{label}</Button>
    </Link>
  );
}

export default function TopNav() {
  const pathname = usePathname();

  // Hide on public pages
  const hideNav = pathname === "/" || pathname.startsWith("/login");
  if (hideNav) return null;

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

        <div className="flex items-center gap-2">
          <NavLink href="/settings" label="Settings" />
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
