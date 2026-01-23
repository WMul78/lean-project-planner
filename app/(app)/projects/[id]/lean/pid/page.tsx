// app/(app)/projects/[id]/lean/pid/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { ensureLeanComponent, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

type PidRow = {
  component_id: string;
  background: string | null;
  problem_statement: string | null;
  objective: string | null;
  scope_in: string | null;
  scope_out: string | null;
  success_criteria: string | null;
  assumptions: string | null;
};

function txt(v: string | null | undefined) {
  return (v ?? "").toString();
}

export default function PidPage() {
  const router = useRouter();
  const params = useParams() as any as Params;
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<"standard" | "pdca" | "dmaic">("standard");

  const allowed = useMemo(() => projectType === "standard" || projectType === "pdca", [projectType]);

  const [componentId, setComponentId] = useState<string | null>(null);

  // fields
  const [background, setBackground] = useState("");
  const [problem, setProblem] = useState("");
  const [objective, setObjective] = useState("");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [success, setSuccess] = useState("");
  const [assumptions, setAssumptions] = useState("");

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

        if (pr.project_type === "dmaic") {
          alert("PID is not available for DMAIC projects.");
          router.replace(`/projects/${projectId}/lean`);
          return;
        }

        // Ensure component exists (will fail on Free/Core due to RLS)
        const comp = await ensureLeanComponent({ project: pr, componentType: "pid" });
        if (cancelled) return;

        setComponentId(comp.id);

        const { data, error } = await supabase
          .from("lean_pid")
          .select("*")
          .eq("component_id", comp.id)
          .single();

        if (error) throw error;
        const row = data as any as PidRow;

        setBackground(txt(row.background));
        setProblem(txt(row.problem_statement));
        setObjective(txt(row.objective));
        setScopeIn(txt(row.scope_in));
        setScopeOut(txt(row.scope_out));
        setSuccess(txt(row.success_criteria));
        setAssumptions(txt(row.assumptions));
      } catch (e: any) {
        console.error("PID load failed:", e);
        // If user is not Pro, RLS will block insert/select -> show upsell
        alert(e?.message ?? "Failed to load PID. If you are not on Pro, upgrade to use Lean tools.");
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
      alert("PID is available on the Pro plan.");
      router.push("/pricing");
      return;
    }
    if (!componentId) return;
    if (saving) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("lean_pid")
        .update({
          background: background.trim() || null,
          problem_statement: problem.trim() || null,
          objective: objective.trim() || null,
          scope_in: scopeIn.trim() || null,
          scope_out: scopeOut.trim() || null,
          success_criteria: success.trim() || null,
          assumptions: assumptions.trim() || null,
        })
        .eq("component_id", componentId);

      if (error) throw error;

      // touch lean_components updated_at (optional but nice)
      await supabase
        .from("lean_components")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", componentId);

      alert("Saved.");
    } catch (e: any) {
      console.error("PID save failed:", e);
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
          <h1 className="text-2xl font-semibold mt-3">PID</h1>
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
          PID is only available for Standard and PDCA projects.
        </div>
      ) : null}

      {!loading && allowed ? (
        <section className="mt-6 grid gap-4">
          <Field label="Background" value={background} onChange={setBackground} disabled={!canEdit} />
          <Field label="Problem statement" value={problem} onChange={setProblem} disabled={!canEdit} />
          <Field label="Objective" value={objective} onChange={setObjective} disabled={!canEdit} />
          <Field label="Scope (in)" value={scopeIn} onChange={setScopeIn} disabled={!canEdit} />
          <Field label="Scope (out)" value={scopeOut} onChange={setScopeOut} disabled={!canEdit} />
          <Field label="Success criteria" value={success} onChange={setSuccess} disabled={!canEdit} />
          <Field label="Assumptions" value={assumptions} onChange={setAssumptions} disabled={!canEdit} />
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
        placeholder=""
      />
    </div>
  );
}
