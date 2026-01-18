import "./globals.css";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: "Improvica Project Planner",
  title: "Improvica Project Planner",
  description: "Improvica project planner (Kaizen / PDCA / DMAIC)",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
