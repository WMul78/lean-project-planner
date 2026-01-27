"use client";

import { usePathname, useRouter } from "next/navigation";
import Button from "@/app/components/Button";

type Props = {
  projectId: string;

  // Back button
  backHref?: string; // default "/projects"

  // Lean button
  leanHref?: string; // default `/projects/${projectId}/lean`

  // Edit button
  canEditProject: boolean;
  isStakeholder: boolean;

  // Chat button
  unreadCount: number;
  onOpenChat: () => void;
};

export default function ProjectTabs({
  projectId,
  backHref = "/projects",
  leanHref,
  canEditProject,
  isStakeholder,
  unreadCount,
  onOpenChat,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const resolvedLeanHref = leanHref ?? `/projects/${projectId}/lean`;
  const leanActive = pathname === resolvedLeanHref || pathname.startsWith(resolvedLeanHref + "/");

  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 mb-4">
      {/* Left side: Back + Lean */}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => router.push(backHref)}>
          ← Back
        </Button>

        <Button
          variant={leanActive ? "primary" : "outline"}
          onClick={() => router.push(resolvedLeanHref)}
        >
          Lean
        </Button>
      </div>

      {/* Right side: Chat + Edit */}
      <div className="flex items-center gap-2">
        {/* Chat icon button (preserves your unread badge behavior) */}
        <button
          type="button"
          onClick={onOpenChat}
          aria-label="Open chat"
          className={[
            "relative",
            "h-12 w-12",
            "rounded-full",
            "border",
            "flex items-center justify-center",
            "transition",
            "shadow-sm hover:shadow-md",
            "active:scale-[0.98]",
            unreadCount > 0
              ? "bg-blue-50 border-blue-200 ring-2 ring-blue-200"
              : "bg-white hover:bg-gray-50",
          ].join(" ")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={["w-6 h-6", unreadCount > 0 ? "text-blue-700" : "text-gray-700"].join(" ")}
          >
            <path d="M20 2H4a2 2 0 0 0-2 2v15.586L6.586 17H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
          </svg>

          {unreadCount > 0 && (
            <span
              className="
                absolute -top-1 -right-1
                min-w-[20px] h-[20px]
                px-1
                rounded-full
                bg-blue-600
                text-white
                text-[11px]
                flex items-center justify-center
                ring-2 ring-white
              "
            >
              {unreadCount}
            </span>
          )}
        </button>

        <Button
          variant="outline"
          onClick={() => router.push(`/projects/${projectId}/edit`)}
          disabled={!canEditProject || isStakeholder}
        >
          Edit project
        </Button>
      </div>
    </div>
  );
}
