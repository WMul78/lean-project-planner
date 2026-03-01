// app/lib/lean.ts
import { supabase } from "@/lib/supabaseClient";

export type LeanComponentType = "pid" | "project_charter" | "five_whys" | "sipoc" | "stakeholder_analysis" | "measure_plan" | "impact_analysis" | "ishikawa" | "lessons_learned";
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

if (componentType === "sipoc") {
  // Create one empty SIPOC row so the user can start typing immediately
  const { error: rowErr } = await supabase.from("lean_sipoc_rows").insert({
    component_id: comp.id,
    order_index: 0,
    supplier: null,
    input: null,
    process: null,
    output: null,
    customer: null,
    requirements: null,
  });
  if (rowErr) throw rowErr;

  // Create one initial process step (editable)
  const { error: stepErr } = await supabase.from("lean_sipoc_steps").insert({
    component_id: comp.id,
    order_index: 0,
    title: "Step 1",
  });
  if (stepErr) throw stepErr;
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

if (componentType === "stakeholder_analysis") {
  const { error: metaErr } = await supabase.from("lean_stakeholder_analysis").insert({
    component_id: comp.id,
    title: "Stakeholder analysis",
  });
  if (metaErr) throw metaErr;

  // Start with 1 row so user can type immediately
  const { error: sErr } = await supabase.from("lean_stakeholders").insert({
    component_id: comp.id,
    name: "New stakeholder",
    role: null,
    interest: 2,
    influence: 2,
    notes: null,
    order_index: 0,
  });
  if (sErr) throw sErr;
}

if (componentType === "measure_plan") {
  const { error: metaErr } = await supabase.from("lean_measure_plan").insert({
    component_id: comp.id,
    title: "Measurement plan",
  });
  if (metaErr) throw metaErr;

  // Start with one row so user can type immediately
  const { error: rowErr } = await supabase.from("lean_measure_plan_rows").insert({
    component_id: comp.id,
    ctq: "New CTQ",
    order_index: 0,
  });
  if (rowErr) throw rowErr;
}

if (componentType === "impact_analysis") {
  const { error: metaErr } = await supabase.from("lean_impact_analysis").insert({
    component_id: comp.id,
    title: "Impact analysis",
  });
  if (metaErr) throw metaErr;

  // Start with 1 item so the user can begin immediately
  const { error: itemErr } = await supabase.from("lean_impact_items").insert({
    component_id: comp.id,
    title: "New idea",
    description: null,
    impact: 4,
    effort: 2,
    order_index: 0,
  });
  if (itemErr) throw itemErr;
}


if (componentType === "ishikawa") {
  // 1) Create meta row
  const { error: metaErr } = await supabase.from("lean_ishikawa").insert({
    component_id: comp.id,
    problem_statement: "Define the problem",
  });
  if (metaErr) throw metaErr;

  // 2) Seed default 6M categories (editable later if you want)
  const defaultCategories = [
    "People",
    "Methods",
    "Machines",
    "Materials",
    "Measurements",
    "Environment",
  ];

  // Insert categories in order
  const { data: cats, error: catsErr } = await supabase
    .from("lean_ishikawa_categories")
    .insert(
      defaultCategories.map((name, idx) => ({
        component_id: comp.id,
        name,
        order_index: idx,
      }))
    )
    .select("id, name, order_index");

  if (catsErr) throw catsErr;

  // 3) (Optional) seed one empty cause in first category for instant UX
  if (cats && cats.length > 0) {
    const { error: causeErr } = await supabase.from("lean_ishikawa_causes").insert({
      category_id: cats[0].id,
      description: "New cause",
      order_index: 0,
    });
    if (causeErr) throw causeErr;
  }
}

if (componentType === "lessons_learned") {
  // Create meta row
  const { error: metaErr } = await supabase.from("lean_lessons_learned").insert({
    component_id: comp.id,
    title: "Lessons learned",
  });
  if (metaErr) throw metaErr;

  // Seed one default row for better UX (optional)
  const { error: rowErr } = await supabase.from("lean_lessons_learned_items").insert({
    component_id: comp.id,
    lesson: "New lesson",
    status: "open",
    order_index: 0,
  });
  if (rowErr) throw rowErr;
}

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

