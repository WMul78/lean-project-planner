"use client";

import { Suspense } from "react";
import Button from "@/app/components/Button";
import InviteAcceptClient from "./InviteAcceptClient";

function LoadingUI() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-gray-600">Accepting invitation…</div>
    </main>
  );
}

function ErrorFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-gray-700">Something went wrong.</p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => (window.location.href = "/projects")}>
            Go to projects
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <InviteAcceptClient />
    </Suspense>
  );
}
