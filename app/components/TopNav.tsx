"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/app/components/Button";

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
      <Button variant={active ? "secondary" : "outline"}>{label}</Button>
    </Link>
  );
}

export default function TopNav() {
  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavLink href="/kanban" label="Kanban" />
          <NavLink href="/gantt" label="Gantt" />
          <NavLink href="/hours" label="Hours" />
        </div>

        <div className="flex items-center gap-2">
          <NavLink href="/settings" label="Settings" />
        </div>
      </div>
    </div>
  );
}
