// app/lib/appContext.ts
import { supabase } from "@/lib/supabaseClient";

export type WorkspaceRole = "owner" | "admin" | "member" | "stakeholder";

export type WorkspaceTier = "free" | "core" | "pro";

export type WorkspaceListItem = {
  workspaceId: string;
  role: WorkspaceRole;
  name?: string; // ✅ no null
};


type RouterLike = { push: (p: string) => void; replace?: (p: string) => void };

function looksLikeAuthTokenProblem(msg: string) {
  const m = (msg || "").toLowerCase();
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

/**
 * Hard reset of auth state (fixes stubborn PWA/localStorage token desync).
 * Exported so TopNav / logout actions can call it.
 */
export async function hardResetAuth() {
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

/**
 * Session-safe user getter.
 * - Prefers getSession() first (fast)
 * - Then validates by calling getUser()
 * - If getUser() fails with token/jwt issues, it hard-resets auth and returns null
 */
export async function getSessionUser() {
  // 1) Read current session once
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) {
    console.warn("getSessionUser: getSession error:", sessErr.message);
    return null;
  }

  const session = sess.session;
  if (!session) return null;

  // 2) Validate by getUser(), but never let it block the UI
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      8000,
      "supabase.auth.getUser()"
    );

    // If Supabase explicitly returns an auth error -> cleanup
    if (error || !data?.user) {
      const msg = error?.message ?? "No user returned";
      console.warn("getSessionUser: invalid user -> cleanup", msg);

      if (looksLikeAuthTokenProblem(msg)) await hardResetAuth();
      else {
        try {
          await supabase.auth.signOut();
        } catch {}
      }
      return null;
    }

    return data.user;
  } catch (e: any) {
    // 3) Timeout / transient failure -> FALL BACK to session.user
    console.warn(
      "getSessionUser: getUser failed/timed out -> fallback to session.user",
      e?.message ?? e
    );
    return session.user ?? null;
  }
}


/**
 * Require logged-in user (client pages)
 */
export async function requireUser(router?: RouterLike) {
  const user = await getSessionUser();
  if (!user) {
    router?.replace ? router.replace("/login") : router?.push("/login");
    return null;
  }
  return user;
}

/**
 * List all workspaces the current user belongs to (for WorkspaceSwitcher).
 */
export async function getWorkspaceList(userId?: string): Promise<WorkspaceListItem[]> {
  const user = userId ? { id: userId } : await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("getWorkspaceList error:", error);
    return [];
  }

  const rows = (data as any[]) ?? [];
  return rows
    .filter((r) => !!r.workspace_id)
    .map((r) => ({
      workspaceId: String(r.workspace_id),
      role: (String(r.role) as WorkspaceRole) ?? "member",
      name: (r.workspaces?.name ?? undefined) as string | undefined,
    }));
}


  

/**
 * Returns the active workspace for the user:
 * - preference: profiles.active_workspace_id
 * - fallback: first workspace in membership list
 */
export async function getActiveWorkspace(): Promise<WorkspaceListItem | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const list = await getWorkspaceList(user.id); // ✅ reuse same userId
  if (list.length === 0) return null;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    console.warn("getActiveWorkspace profile load error:", profErr);
    return list[0] ?? null;
  }

  const activeId = (profile as any)?.active_workspace_id as string | null;
  const byProfile = activeId ? list.find((w) => w.workspaceId === activeId) : null;
  return byProfile ?? list[0] ?? null;
}


/**
 * Persist active workspace to profile.
 * (WorkspaceSwitcher uses this)
 */
export async function setActiveWorkspace(workspaceId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);

  if (error) throw error;
}

/**
 * Effective tier for the active workspace (free/core/pro).
 * Uses RPC: workspace_effective_tier(workspace_id)
 */
export async function getActiveWorkspaceTier(): Promise<WorkspaceTier> {
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
