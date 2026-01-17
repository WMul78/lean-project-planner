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

async function getSessionUser() {
  // 1) Fast path: local session
  const { data: sess } = await supabase.auth.getSession();
  if (sess.session?.user) return sess.session.user;

  // 2) Fallback: ask Supabase (network) — fixes “session not yet hydrated” cases
  const { data: u, error } = await supabase.auth.getUser();
  if (error) return null;
  return u.user ?? null;
}

export async function requireUser(router?: { push: (p: string) => void }) {
  const user = await getSessionUser();
  if (!user) {
    router?.push("/login");
    return null;
  }
  return user;
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
