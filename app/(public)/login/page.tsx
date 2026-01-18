// app/login/page.tsx
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

type SearchParamsValue = string | string[] | undefined;
type SearchParamsPromise = Promise<Record<string, SearchParamsValue>>;

function pickFirst(v: SearchParamsValue) {
  return Array.isArray(v) ? v[0] : v;
}

function safeInternalPath(p?: string) {
  if (!p) return "/projects";
  if (!p.startsWith("/")) return "/projects";
  return p;
}

export default async function LoginPage({
  searchParams,
}: {
  // NOTE: In your Next.js version, searchParams is typed as a Promise.
  searchParams?: SearchParamsPromise;
}) {
  const sp = searchParams ? await searchParams : {};

  const nextRaw = pickFirst(sp.next);
  const modeRaw = pickFirst(sp.mode);

  const nextPath = safeInternalPath(nextRaw);
  const initialMode = modeRaw === "signup" ? "signup" : "signin";

  return <LoginClient nextPath={nextPath} initialMode={initialMode} />;
}
