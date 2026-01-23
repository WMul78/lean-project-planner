// app/(app)/projects/[id]/lean/charter/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { ensureLeanComponent, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

type CharterRow = {
  component_id: string;
  business_case: string | null;
  problem_statement: string | null;
  goal_statement: string | null;
  in_scope: string | null;
  out_of_scope: string | null;
  high_level_timeline: string | null;
  financial_impact: string | null;
  constraints: string | null;
};

function txt(v: string | null | undefined) {
  return (v ?? "").toString();
}

export default function CharterPage() {
  const router = useRouter();
  const params = useParams() as any as Params;
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<"standard" | "pdca" | "dmaic">("standard");

  const allowed = useMemo(() => projectType === "dmaic", [projectType]);

  const [componentId, setComponentId] = useState<string | null>(null);

  // fields
  const [businessCase, setBusinessCase] = useState("");
  const [problem, setProblem] = useState("");
  const [goal, setGoal] = useState("");
  const [inScope, setInScope] = useState("");
  const [outScope, setOutScope] = useState("");
  const [timeline, setTimeline] = useState("");
  const [financialImpact, setFinancialImpact] = useState("");
  const [constraints, setConstraints] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const user = await requireUser(router);
        if (!user) return;

        const t = await getActiveWorkspaceTier();
        if (!cancelled) setTier(t ?? "free");

        const pr = await loadProjectLean(projectId);
        if (cancelled) return;

        setProjectName(pr.name ?? "");
        setProjectType(pr.project_type);

        if (pr.project_type !== "dmaic") {
          alert("Project Charter is only available for DMAIC projects.");
          router.replace(`/projects/${projectId}/lean`);
          return;
        }

        const comp = await ensureLeanComponent({ project: pr, componentType: "project_charter" });
        if (cancelled) return;

        setComponentId(comp.id);

        const { data, error } = await supabase
          .from("lean_project_charter")
          .select("*")
          .eq("component_id", comp.id)
          .single();

        if (error) throw error;
        const row = data as any as CharterRow;

        setBusinessCase(txt(row.business_case));
        setProblem(txt(row.problem_statement));
        setGoal(txt(row.goal_statement));
        setInScope(txt(row.in_scope));
        setOutScope(txt(row.out_of_scope));
        setTimeline(txt(row.high_level_timeline));
        setFinancialImpact(txt(row.financial_impact));
        setConstraints(txt(row.constraints));
      } catch (e: any) {
        console.error("Charter load failed:", e);
        alert(e?.message ?? "Failed to load Charter. If you are not on Pro, upgrade to use Lean tools.");
        router.replace(`/projects/${projectId}/lean`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  async function save() {
    if (!allowed) return;
    if (!canEdit) {
      alert("Project Charter is available on the Pro plan.");
      router.push("/pricing");
      return;
    }
    if (!componentId) return;
    if (saving) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("lean_project_charter")
        .update({
          business_case: businessCase.trim() || null,
          problem_statement: problem.trim() || null,
          goal_statement: goal.trim() || null,
          in_scope: inScope.trim() || null,
          out_of_scope: outScope.trim() || null,
          high_level_timeline: timeline.trim() || null,
          financial_impact: financialImpact.trim() || null,
          constraints: constraints.trim() || null,
        })
        .eq("component_id", componentId);

      if (error) throw error;

      await supabase
        .from("lean_components")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", componentId);

      alert("Saved.");
    } catch (e: any) {
      console.error("Charter save failed:", e);
      alert(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Project Charter</h1>
          <div className="mt-1 text-sm text-gray-600">
            Project: <span className="font-medium text-gray-800">{projectName || projectId}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button onClick={save} disabled={loading || saving || !allowed || !canEdit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading && !allowed ? (
        <div className="mt-6 border rounded-xl p-4 bg-amber-50 border-amber-200">
          Project Charter is only available for DMAIC projects.
        </div>
      ) : null}

      {!loading && allowed ? (
        <section className="mt-6 grid gap-4">
          <Field label="Business case" value={businessCase} onChange={setBusinessCase} disabled={!canEdit} />
          <Field label="Problem statement" value={problem} onChange={setProblem} disabled={!canEdit} />
          <Field label="Goal statement" value={goal} onChange={setGoal} disabled={!canEdit} />
          <Field label="In scope" value={inScope} onChange={setInScope} disabled={!canEdit} />
          <Field label="Out of scope" value={outScope} onChange={setOutScope} disabled={!canEdit} />
          <Field label="High-level timeline" value={timeline} onChange={setTimeline} disabled={!canEdit} />
          <Field label="Financial impact" value={financialImpact} onChange={setFinancialImpact} disabled={!canEdit} />
          <Field label="Constraints" value={constraints} onChange={setConstraints} disabled={!canEdit} />
        </section>
      ) : null}
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-gray-800">{props.label}</label>
      <textarea
        className="border rounded-xl px-3 py-2 min-h-[110px] text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      />
    </div>
  );
}
