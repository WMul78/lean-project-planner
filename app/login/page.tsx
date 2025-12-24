"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) return alert(error.message);
    router.push("/projects");
  }

  async function signUp() {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setIsLoading(false);

    if (error) return alert(error.message);
    alert("Account aangemaakt. Als email-confirm aan staat: check je inbox.");
  }

  return (
  <main className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold mb-4 text-center">
        Login
      </h1>

      <form onSubmit={signIn} className="grid gap-3">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="wachtwoord"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            type="submit"
            disabled={isLoading}
            className="flex-1"
          >
            Inloggen
          </Button>

          <Button
            variant="secondary"
            onClick={signUp}
            disabled={isLoading}
            className="flex-1"
          >
            Registreren
          </Button>
        </div>
      </form>
    </div>
  </main>
);

}
