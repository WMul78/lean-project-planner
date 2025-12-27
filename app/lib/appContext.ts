// app/lib/appContext.ts
import { supabase } from "@/lib/supabaseClient";

export type WorkspaceRole = "owner" | "admin" | "member" | "stakeholder";

export async function requireUser(router?: { push: (p: string) => void }) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    router?.push("/login");
    return null;
  }
  return data.user;
}

export async function getWorkspaceList() {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(name)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((m: any) => ({
    workspaceId: m.workspace_id as string,
    role: (m.role as WorkspaceRole) ?? "member",
    name: m.workspaces?.name as string | undefined,
  }));
}

export async function getActiveWorkspace() {
  // 1) profile.active_workspace_id proberen
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const list = await getWorkspaceList();
  if (list.length === 0) return null;

  const byProfile = profile?.active_workspace_id
    ? list.find((w) => w.workspaceId === profile.active_workspace_id)
    : null;

  return byProfile ?? list[0];
}

export async function setActiveWorkspace(workspaceId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);

  if (error) throw error;
}


