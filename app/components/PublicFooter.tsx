"use client";

import Link from "next/link";

type Props = {
  className?: string;
  /** If you want to show extra app-only links later, keep this for future extension. */
  variant?: "public" | "app";
};

export default function PublicFooter({ className, variant = "public" }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className={["bg-white/80 border-t border-gray-200", className ?? ""].join(" ")}>
      <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-gray-500 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="font-medium text-gray-700">Improvica Project Planner</div>
          <div>© {year} Improvica</div>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          {/* Required/legal links */}
          <Link className="hover:text-gray-800 underline underline-offset-2" href="/terms">
            Terms of Service
          </Link>
          <Link className="hover:text-gray-800 underline underline-offset-2" href="/refunds">
            Refund Policy
          </Link>
          <Link className="hover:text-gray-800 underline underline-offset-2" href="/privacy">
            Privacy Policy
          </Link>

          <span className="hidden sm:inline text-gray-300">•</span>

          {/* Convenience links */}
          <Link className="hover:text-gray-800" href="/login">
            Login
          </Link>
          <Link className="hover:text-gray-800" href="/invites">
            Accept invite
          </Link>
          {/* pricing is gated → go via login */}
          <Link className="hover:text-gray-800" href="/login?next=/pricing">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}