import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/components/TopNav";
import AuthBoundary from "@/app/components/AuthBoundary";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <AuthBoundary />
        {children}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TopNav />
        {/* Add top padding to account for the fixed navigation bar */}
        <div className="pt-[72px]">{children}</div>
      </body>
    </html>
  );
}
