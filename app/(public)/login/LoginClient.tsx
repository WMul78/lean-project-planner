"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser } from "@/app/lib/appContext";

type Mode = "signin" | "signup";

export default function LoginClient({
  nextPath,
  initialMode,
}: {
  nextPath: string;
  initialMode: Mode;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // If user is already logged in, go to next
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data, error } = await supabase.auth.getUser();
        if (!cancelled) {
        if (error) {
          // If token is stale, let user log in normally
          console.warn("Login page getUser error:", error.message);
          return;
        }
          if (data.user) router.replace(nextPath);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  // app/(public)/login/LoginClient.tsx
async function handleSignIn(e: React.FormEvent) {
  e.preventDefault();
  setInfo(null);
  setIsLoading(true);

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // ✅ Force clean app mount (prevents "loading forever" after relogin)
    window.location.href = nextPath;
  } catch (err: any) {
    alert(err?.message ?? "Login failed");
  } finally {
    setIsLoading(false);
  }
}


  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setIsLoading(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: origin
          ? { emailRedirectTo: `${origin}/auth/callback` }
          : undefined,
      });

      if (error) throw error;

      // If email confirmation is enabled, session may be null.
      if (!data.session) {
        setInfo("Account created. Please check your email to confirm your account, then log in.");
        setMode("signin");
        return;
      }

      router.replace(nextPath);
    } catch (err: any) {
      alert(err?.message ?? "Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center p-6">
      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_65%)]" />
        <div className="absolute -bottom-56 -right-56 h-[660px] w-[660px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {mode === "signup"
              ? "Create a free account first. Upgrade to Pro later when you want to start a trial."
              : "Log in to continue."}
          </p>

          {/* Mode switch */}
          <div className="mt-5 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signin" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Register
            </button>
          </div>

          {info ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
              {info}
            </div>
          ) : null}

          <form
            onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
            className="mt-5 grid gap-3"
          >
            <input
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            {/* Clear CTA colors:
                - Primary action = CTA (blue)
                - Secondary = outline
             */}
            <div className="flex gap-2 pt-2">
              {mode === "signin" ? (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    className="flex-1"
                    onClick={() => setMode("signup")}
                  >
                    Register
                  </Button>

                  <Button variant="cta" type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Signing in…" : "Login"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    className="flex-1"
                    onClick={() => setMode("signin")}
                  >
                    Back to login
                  </Button>

                  <Button variant="cta" type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Creating…" : "Create account"}
                  </Button>
                </>
              )}
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500">
            After login you’ll continue to: <span className="font-medium text-gray-700">{nextPath}</span>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link className="text-gray-600 hover:text-gray-900 underline" href="/">
              Back to home
            </Link>
            <Link className="text-gray-600 hover:text-gray-900 underline" href="/pricing">
              Pricing (members)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
