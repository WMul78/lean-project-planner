// app/(app)/projects/[id]/lean/charter/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { ensureLeanComponent, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

type CharterRow = {
  component_id: string;

  // existing (legacy)
  business_case: string | null;
  problem_statement: string | null;
  goal_statement: string | null;
  in_scope: string | null;
  out_of_scope: string | null;
  high_level_timeline: string | null;
  financial_impact: string | null;
  constraints: string | null;

  // new (recommended)
  product_delivered?: string | null;
  customer?: string | null;
  project_manager?: string | null;
  sponsor?: string | null;
  hard_benefits?: string | null;
  soft_benefits?: string | null;
  costs_budget?: string | null;
  risks?: string | null;
};

function txt(v: string | null | undefined) {
  return (v ?? "").toString();
}

/**
 * Auto-resizing textarea (grows & shrinks with content).
 * - Uses scrollHeight measurement
 * - Keeps a minimum height per "size"
 */
function AutoTextarea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  size?: "small" | "medium";
  placeholder?: string;
}) {
  const { size = "medium" } = props;
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const minH =
    size === "small"
      ? "min-h-[70px]" // smaller boxes
      : "min-h-[110px]"; // medium boxes (similar to old UI) :contentReference[oaicite:2]{index=2}

  // Resize on value changes (load + typing)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // reset to allow shrinking
    el.style.height = "0px";
    const next = Math.max(el.scrollHeight, size === "small" ? 70 : 110);
    el.style.height = `${next}px`;
  }, [props.value, size]);

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-gray-800">{props.label}</label>
      <textarea
        ref={ref}
        className={[
          "border rounded-xl px-3 py-2 text-sm w-full resize-none",
          "focus:outline-none focus:ring-2 focus:ring-gray-200",
          minH,
        ].join(" ")}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      />
    </div>
  );
}

function SmallInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-gray-800">{props.label}</label>
      <input
        className={[
          "border rounded-xl px-3 py-2 text-sm w-full",
          "focus:outline-none focus:ring-2 focus:ring-gray-200",
        ].join(" ")}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      />
    </div>
  );
}

export default function ProjectCharterPage() {
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

  // === Fields (new model) ===
  const [problemStatement, setProblemStatement] = useState(""); // medium
  const [productDelivered, setProductDelivered] = useState(""); // small

  const [customer, setCustomer] = useState(""); // small name
  const [projectManager, setProjectManager] = useState(""); // small name
  const [sponsor, setSponsor] = useState(""); // small name

  const [hardBenefits, setHardBenefits] = useState(""); // medium
  const [softBenefits, setSoftBenefits] = useState(""); // medium
  const [costsBudget, setCostsBudget] = useState(""); // small

  const [inScope, setInScope] = useState(""); // medium
  const [outScope, setOutScope] = useState(""); // medium
  const [risks, setRisks] = useState(""); // medium

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

        // Ensure component exists (will fail on Free/Core due to RLS)
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

        // Prefer NEW columns, fallback to old ones so existing data stays visible.
        setProblemStatement(txt(row.problem_statement));

        setProductDelivered(txt(row.product_delivered ?? row.goal_statement)); // fallback
        setCustomer(txt(row.customer));
        setProjectManager(txt(row.project_manager));
        setSponsor(txt(row.sponsor));

        setHardBenefits(txt(row.hard_benefits ?? row.financial_impact)); // fallback
        setSoftBenefits(txt(row.soft_benefits));

        setCostsBudget(txt(row.costs_budget));
        setInScope(txt(row.in_scope));
        setOutScope(txt(row.out_of_scope));

        setRisks(txt(row.risks ?? row.constraints)); // fallback
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
      const payload: Record<string, any> = {
        // keep core ones aligned with your requested list
        problem_statement: problemStatement.trim() || null,
        in_scope: inScope.trim() || null,
        out_of_scope: outScope.trim() || null,

        // new columns
        product_delivered: productDelivered.trim() || null,
        customer: customer.trim() || null,
        project_manager: projectManager.trim() || null,
        sponsor: sponsor.trim() || null,
        hard_benefits: hardBenefits.trim() || null,
        soft_benefits: softBenefits.trim() || null,
        costs_budget: costsBudget.trim() || null,
        risks: risks.trim() || null,

        /**
         * Optional: also write to legacy columns for backwards compatibility
         * (handig als je ergens anders nog legacy velden toont).
         */
        goal_statement: productDelivered.trim() || null,
        financial_impact: hardBenefits.trim() || null,
        constraints: risks.trim() || null,
      };

      const { error } = await supabase.from("lean_project_charter").update(payload).eq("component_id", componentId);
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
    <main className="p-6 max-w-4xl mx-auto">
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
          {/* Row 1: problem + product + costs */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <AutoTextarea
                label="Problem statement"
                value={problemStatement}
                onChange={setProblemStatement}
                disabled={!canEdit}
                size="medium"
              />
            </div>

            <div className="grid gap-4">
              <AutoTextarea
                label="Product / what is delivered"
                value={productDelivered}
                onChange={setProductDelivered}
                disabled={!canEdit}
                size="small"
              />

              <AutoTextarea
                label="Costs (budget)"
                value={costsBudget}
                onChange={setCostsBudget}
                disabled={!canEdit}
                size="small"
                placeholder="e.g. €10,000 or 80 hours"
              />
            </div>
          </div>

          {/* Row 2: names */}
          <div className="grid gap-4 md:grid-cols-3">
            <SmallInput label="Customer" value={customer} onChange={setCustomer} disabled={!canEdit} placeholder="Name" />
            <SmallInput
              label="Project manager"
              value={projectManager}
              onChange={setProjectManager}
              disabled={!canEdit}
              placeholder="Name"
            />
            <SmallInput label="Sponsor" value={sponsor} onChange={setSponsor} disabled={!canEdit} placeholder="Name" />
          </div>

          {/* Row 3: benefits */}
          <div className="grid gap-4 md:grid-cols-2">
            <AutoTextarea
              label="Hard benefits"
              value={hardBenefits}
              onChange={setHardBenefits}
              disabled={!canEdit}
              size="medium"
            />
            <AutoTextarea
              label="Soft benefits"
              value={softBenefits}
              onChange={setSoftBenefits}
              disabled={!canEdit}
              size="medium"
            />
          </div>

          {/* Row 4: scope */}
          <div className="grid gap-4 md:grid-cols-2">
            <AutoTextarea label="In scope" value={inScope} onChange={setInScope} disabled={!canEdit} size="medium" />
            <AutoTextarea label="Out of scope" value={outScope} onChange={setOutScope} disabled={!canEdit} size="medium" />
          </div>

          {/* Row 5: risks */}
          <AutoTextarea label="Risks" value={risks} onChange={setRisks} disabled={!canEdit} size="medium" />
        </section>
      ) : null}
    </main>
  );
}