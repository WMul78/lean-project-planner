// app/lib/lean.ts
import { supabase } from "@/lib/supabaseClient";

export type LeanComponentType = "pid" | "project_charter" | "five_whys";
export type WorkspaceTier = "free" | "core" | "pro";
export type ProjectType = "standard" | "pdca" | "dmaic";

export type ProjectRowLean = {
  id: string;
  workspace_id: string;
  project_type: ProjectType;
  name: string;
};

export type LeanComponentRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  component_type: LeanComponentType;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function loadProjectLean(projectId: string): Promise<ProjectRowLean> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, workspace_id, project_type, name")
    .eq("id", projectId)
    .single();

  if (error) throw error;
  return data as any;
}

export async function loadLeanComponent(projectId: string, componentType: LeanComponentType) {
  const { data, error } = await supabase
    .from("lean_components")
    .select("*")
    .eq("project_id", projectId)
    .eq("component_type", componentType)
    .maybeSingle();

  if (error) throw error;
  return (data as any) as LeanComponentRow | null;
}

/**
 * Ensure lean component exists. If missing, create lean_components + detail table row.
 * RLS must allow insert only on Pro; this function will surface that error.
 */
export async function ensureLeanComponent(params: {
  project: ProjectRowLean;
  componentType: LeanComponentType;
}) {
  const { project, componentType } = params;

  // 1) Existing?
  const existing = await loadLeanComponent(project.id, componentType);
  if (existing) return existing;

  // 2) Create lean_components
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userRes.user) throw new Error("Not authenticated");

  const { data: comp, error: insErr } = await supabase
    .from("lean_components")
    .insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      component_type: componentType,
      status: "draft",
      created_by: userRes.user.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insErr) throw insErr;

  // 3) Create detail row (PID / Charter)
  if (componentType === "pid") {
    const { error } = await supabase.from("lean_pid").insert({
      component_id: (comp as any).id,
    });
    if (error) throw error;
  }

  if (componentType === "project_charter") {
    const { error } = await supabase.from("lean_project_charter").insert({
      component_id: (comp as any).id,
    });
    if (error) throw error;
  }

// app/lib/lean.ts (inside ensureLeanComponent after lean_components insert)
if (componentType === "five_whys") {
  const { error: detailErr } = await supabase.from("lean_five_whys").insert({
    component_id: comp.id,
    problem_statement: null,
    why_1: null,
    why_2: null,
    why_3: null,
    why_4: null,
    why_5: null,
    root_cause: null,
  });
  if (detailErr) throw detailErr;
}


  return (comp as any) as LeanComponentRow;
}



// List all components of a type within a project
export async function listLeanComponents(projectId: string, componentType: LeanComponentType) {
  const { data, error } = await supabase
    .from("lean_components")
    .select(`
      id,
      created_at,
      component_type,
      lean_five_whys (
        problem_statement
      )
    `)
    .eq("project_id", projectId)
    .eq("component_type", componentType)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Create a NEW component instance (no "ensure", always a new one)
export async function createLeanComponentInstance(params: {
  project: any; // use your ProjectRowLean type if you have it
  componentType: LeanComponentType;
}) {
  const { project, componentType } = params;

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userRes.user) throw new Error("Not authenticated");

  const { data: comp, error: insErr } = await supabase
    .from("lean_components")
    .insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      component_type: componentType,
      status: "draft",
      created_by: userRes.user.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insErr) throw insErr;

  // Detail row for 5 whys
  if (componentType === "five_whys") {
    const { error: detailErr } = await supabase.from("lean_five_whys").insert({
      component_id: comp.id,
      problem_statement: null,
      why_1: null,
      why_2: null,
      why_3: null,
      why_4: null,
      why_5: null,
      root_cause: null,
    });
    if (detailErr) throw detailErr;
  }

  return comp;
}