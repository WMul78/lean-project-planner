// app/lib/appContext.ts
import { supabase } from "@/lib/supabaseClient";

// Returns 'free' | 'core' | 'pro'
export async function getActiveWorkspaceTier(): Promise<"free" | "core" | "pro"> {
  const ws = await getActiveWorkspace();
  if (!ws?.workspaceId) return "free";

  const { data, error } = await supabase.rpc("workspace_effective_tier", {
    p_workspace_id: ws.workspaceId,
  });

  if (error) {
    console.warn("workspace_effective_tier error:", error);
    return "free";
  }

  const t = String(data ?? "free");
  if (t === "core" || t === "pro") return t;
  return "free";
}

export type WorkspaceRole = "owner" | "admin" | "member" | "stakeholder";

async function hardResetAuth() {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  // Extra cleanup for stubborn PWA/localStorage cases
  try {
    if (typeof window !== "undefined") {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.push(k);
      }
      // Supabase keys often start with "sb-"
      for (const k of keys) {
        if (k.startsWith("sb-")) window.localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

function looksLikeAuthTokenProblem(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("jwt") ||
    m.includes("token") ||
    m.includes("invalid") ||
    m.includes("expired") ||
    m.includes("not authenticated") ||
    m.includes("refresh")
  );
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timeout: ${label}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export async function getSessionUser() {
  // 1) Fast path: local session (can be stale)
  const sessRes = await withTimeout(supabase.auth.getSession(), 4000, "getSession()");
  const sessionUser = sessRes.data.session?.user ?? null;
  if (sessionUser) return sessionUser;

  // 2) Fallback: ask Supabase (network)
  try {
    const uRes = await withTimeout(supabase.auth.getUser(), 5000, "getUser()");
    return uRes.data.user ?? null;
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    // If auth is corrupted/stale, hard reset so UI won’t hang in limbo
    if (looksLikeAuthTokenProblem(msg)) {
      console.warn("Auth looks stale/corrupt -> hard reset:", msg);
      await hardResetAuth();
      return null;
    }

    console.warn("getSessionUser failed:", msg);
    return null;
  }
}


export async function getWorkspaceList() {
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // dedupe op workspaceId (voor de zekerheid)
  const map = new Map<string, { workspaceId: string; role: WorkspaceRole; name?: string }>();
  for (const m of (data ?? []) as any[]) {
    map.set(m.workspace_id, {
      workspaceId: m.workspace_id,
      role: (m.role as WorkspaceRole) ?? "member",
      name: m.workspaces?.name,
    });
  }

  return Array.from(map.values());
}

export async function getActiveWorkspace() {
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
  if (!user) return null;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    console.warn("getActiveWorkspace profile error:", profErr);
  }

  const list = await getWorkspaceList();
  if (list.length === 0) return null;

  const byProfile = profile?.active_workspace_id
    ? list.find((w) => w.workspaceId === profile.active_workspace_id)
    : null;

  if (profile?.active_workspace_id && !byProfile) {
    console.warn(
      "active_workspace_id not in membership list",
      profile.active_workspace_id,
      list.map((w) => w.workspaceId)
    );
  }

  return byProfile ?? list[0];
}

export async function setActiveWorkspace(workspaceId: string) {
  // ✅ Replaces getUser() with getSession()
  const user = await getSessionUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);

  if (error) throw error;
}

export async function requireUser(router?: { push: (p: string) => void; replace?: (p: string) => void }) {
  const user = await getSessionUser();
  if (!user) {
    // Replace prevents weird history loops in PWA
    router?.replace ? router.replace("/login") : router?.push("/login");
    return null;
  }
  return user;
}
