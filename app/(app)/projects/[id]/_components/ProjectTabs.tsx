"use client";

import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";

type Props = {
  projectId: string;
};

const tabs = [
  { key: "overview", label: "Overview", href: (id: string) => `/projects/${id}` },
  { key: "tasks", label: "Tasks", href: (id: string) => `/projects/${id}/tasks` },
  { key: "planning", label: "Planning", href: (id: string) => `/projects/${id}/planning` },
  { key: "lean", label: "Lean", href: (id: string) => `/projects/${id}/lean` },
  { key: "chat", label: "Chat", href: (id: string) => `/projects/${id}/chat` },
];

export default function ProjectTabs({ projectId }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex gap-2 border-b pb-2 mb-4">
      {tabs.map((tab) => {
        const href = tab.href(projectId);
        const active =
          pathname === href || pathname.startsWith(href + "/");

        return (
          <Button
            key={tab.key}
            variant={active ? "primary" : "outline"}
            onClick={() => router.push(href)}
          >
            {tab.label}
          </Button>
        );
      })}
    </nav>
  );
}
