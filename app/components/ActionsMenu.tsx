"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/Button";

export type ActionsMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export default function ActionsMenu({
  items,
  align = "right",
  icon = "dots",
}: {
  items: ActionsMenuItem[];
  align?: "left" | "right";
  icon?: "dots" | "gear";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const Icon = () => {
    if (icon === "gear") {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-gray-700">
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.24-1.12.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.39 1.05.7 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.24 1.12-.55 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
          />
        </svg>
      );
    }

    // dots
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" className="text-gray-700">
        <path
          fill="currentColor"
          d="M12 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 7Zm0 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 14Zm0 7a2 2 0 1 0-0.001-4.001A2 2 0 0 0 12 21Z"
        />
      </svg>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen((v) => !v)} aria-label="">
        <span className="inline-flex items-center gap-2">
          <Icon />
          <span className="hidden sm:inline"></span>
        </span>
      </Button>

      {open ? (
        <div
          className={[
            "absolute z-50 mt-2 w-56 rounded-lg border bg-white shadow-lg overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          <ul className="py-1">
            {items.map((it, idx) => (
              <li key={idx}>
                <button
                  className={[
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",
                    it.danger ? "text-red-600 hover:bg-red-50" : "text-gray-800",
                  ].join(" ")}
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
