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

export async function getActiveWorkspace() {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.workspace_id) return null;

  return {
    workspaceId: data.workspace_id as string,
    role: (data.role as WorkspaceRole) ?? "member",
  };
}
