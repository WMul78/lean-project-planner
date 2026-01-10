// app/login/page.tsx
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function pickFirst(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

function safeInternalPath(p?: string) {
  if (!p) return "/projects";
  if (!p.startsWith("/")) return "/projects";
  return p;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: {
    next?: string | string[];
    mode?: string | string[];
  };
}) {
  const nextRaw = pickFirst(searchParams?.next);
  const modeRaw = pickFirst(searchParams?.mode);

  const nextPath = safeInternalPath(nextRaw);
  const initialMode = modeRaw === "signup" ? "signup" : "signin";

  return <LoginClient nextPath={nextPath} initialMode={initialMode} />;
}
