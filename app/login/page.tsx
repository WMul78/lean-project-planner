// app/login/page.tsx
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  next?: string | string[];
  mode?: string | string[];
};

function pickFirst(v?: string | string[]) {
  return Array.isArray(v) ? v[0] : v;
}

function safeInternalPath(p?: string) {
  if (!p) return "/projects";
  if (!p.startsWith("/")) return "/projects";
  // optional: prevent redirecting to auth endpoints etc.
  return p;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const nextRaw = pickFirst(searchParams?.next);
  const modeRaw = pickFirst(searchParams?.mode);

  const nextPath = safeInternalPath(nextRaw);
  const initialMode = modeRaw === "signup" ? "signup" : "signin";

  return <LoginClient nextPath={nextPath} initialMode={initialMode} />;
}
