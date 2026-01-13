"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";

export default function PublicHeader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setShow(!data.user);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!show) return null;

  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold text-gray-900">
          Improvica
        </Link>

        <div className="flex items-center gap-2">
          <a href="#pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </a>

          <Link href="/login?mode=signin&next=/projects">
            <Button variant="outline">Log in</Button>
          </Link>

          <Link href="/login?mode=signup&next=/projects">
            <Button>Create account</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
