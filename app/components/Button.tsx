"use client";

import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className,
}: ButtonProps) {
  const base =
    "px-4 py-2 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
  primary: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 hover:border-gray-400",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
  outline:
    "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 hover:border-gray-400",
};

  return (
    <button
  	type={type}
  	onClick={onClick}
  	disabled={disabled}
  	className={`${base} ${variants[variant]} ${className ?? ""}`}
       >
      {children}
    </button>
  );
}
