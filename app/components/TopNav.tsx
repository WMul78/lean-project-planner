"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/app/components/Button";
import { hardResetAuth } from "@/app/lib/appContext";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className="inline-flex">
      <Button variant={active ? "secondary" : "outline"}>
        {label}
      </Button>
    </Link>
  );
}

export default function TopNav() {
  async function handleLogout() {
    // 🔥 harde reset, geen router.replace / refresh
    await hardResetAuth();
    window.location.href = "/login";
  }

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left navigation */}
        <div className="flex items-center gap-2">
          <NavLink href="/kanban" label="Kanban" />
          <NavLink href="/gantt" label="Gantt" />
          <NavLink href="/hours" label="Hours" />
          <NavLink href="/projects" label="Projects" />
        </div>

        {/* Right menu (settings + logout) */}
        <div className="flex items-center gap-2">
          <NavLink href="/settings" label="Settings" />

          <Button
            variant="danger"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
