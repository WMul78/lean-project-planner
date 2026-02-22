// app/(app)/projects/[id]/lean/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import { loadProjectLean, loadLeanComponent } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

function ToolCard(props: {
  title: string;
  description: string;
  status?: string;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="border rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="font-semibold">{props.title}</div>
        <div className="text-sm text-gray-600">{props.description}</div>
        {props.status ? <div className="text-xs text-gray-500 mt-1">Status: {props.status}</div> : null}
      </div>

      <Button variant="outline" onClick={props.onOpen} disabled={props.disabled}>
        Open
      </Button>
    </div>
  );
}

function SectionHeader(props: { title: string; subtitle?: string }) {
  const colorMap: Record<string, string> = {
    Define: "bg-blue-700 text-white",
    Measure: "bg-emerald-600 text-white",
    Analyze: "bg-amber-500 text-white",
    Improve: "bg-orange-600 text-white",
    Control: "bg-rose-600 text-white",
  };

  const bgColor = colorMap[props.title] ?? "bg-gray-600";

  return (
    <div className="mt-10">
      <div className={`${bgColor} text-white rounded-xl px-6 py-4`}>
        <h2 className="text-xl font-semibold tracking-wide">
          {props.title}
        </h2>

        {props.subtitle ? (
          <div className="text-sm text-white/90 mt-1 max-w-3xl">
            {props.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LeanHubPage() {
  const router = useRouter();
  const params = useParams() as any as Params;
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");

  const [projectType, setProjectType] = useState<"standard" | "pdca" | "dmaic">("standard");
  const [projectName, setProjectName] = useState<string>("");

  const [hasPid, setHasPid] = useState(false);
  const [hasCharter, setHasCharter] = useState(false);

  const [fiveWhysCount, setFiveWhysCount] = useState(0);
  const [sipocCount, setSipocCount] = useState(0);
  const [stakeholderCount, setStakeholderCount] = useState(0);

  const canUseLeanTools = tier === "pro";
  const canHavePid = projectType === "standard" || projectType === "pdca";
  const canHaveCharter = projectType === "dmaic";
  const [measurePlanCount, setMeasurePlanCount] = useState(0);

  const upsellText = useMemo(() => {
    if (tier === "pro") return null;
    return "Lean tools are available on the Pro plan.";
  }, [tier]);

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

        setProjectType(pr.project_type);
        setProjectName(pr.name ?? "");

        // Single-instance tools
        const [pid, charter] = await Promise.all([
          loadLeanComponent(projectId, "pid").catch(() => null),
          loadLeanComponent(projectId, "project_charter").catch(() => null),
        ]);
        if (cancelled) return;
        setHasPid(!!pid);
        setHasCharter(!!charter);

        // Multi-instance tools (counts)
        const [
          { count: wCnt, error: wErr },
          { count: sCnt, error: sErr },
          { count: stCnt, error: stErr },
        ] = await Promise.all([
          supabase
            .from("lean_components")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("component_type", "five_whys"),
          supabase
            .from("lean_components")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("component_type", "sipoc"),
          supabase
            .from("lean_components")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("component_type", "stakeholder_analysis"),
        ]);


        const { count: mpCnt, error: mpErr } = await supabase
  .from("lean_components")
  .select("id", { count: "exact", head: true })
  .eq("project_id", projectId)
  .eq("component_type", "measure_plan");

if (!mpErr) setMeasurePlanCount(mpCnt ?? 0);

        // Don't hard-fail the whole page on count errors
        if (!wErr) setFiveWhysCount(wCnt ?? 0);
        if (!sErr) setSipocCount(sCnt ?? 0);
        if (!stErr) setStakeholderCount(stCnt ?? 0);
      } catch (e: any) {
        console.error("Lean hub load failed:", e);
        alert(e?.message ?? "Failed to load Lean tools.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Lean tools</h1>
          <div className="mt-1 text-sm text-gray-600">
            Project: <span className="font-medium text-gray-800">{projectName || projectId}</span> • type:{" "}
            <span className="font-medium text-gray-800">{projectType}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading && upsellText ? (
        <div className="mt-6 border rounded-xl p-4 bg-amber-50 border-amber-200">
          <div className="font-semibold text-amber-900">Upgrade to Pro</div>
          <div className="text-sm text-amber-900/80 mt-1">{upsellText}</div>
          <div className="mt-3">
            <Button onClick={() => router.push("/pricing")}>See Pro plan</Button>
          </div>
        </div>
      ) : null}

      {/* DMAIC grouping */}
      <section className="mt-6 grid gap-3">
        <SectionHeader title="Define" subtitle="Clarify the problem, scope, stakeholders and high-level process." />

        {/* Project Charter (DMAIC only) */}
        {canHaveCharter ? (
          <ToolCard
            title="Project Charter (DMAIC)"
            description="Business case, goal statement, scope and team for DMAIC projects."
            status={hasCharter ? "created" : "not created"}
            onOpen={() => router.push(`/projects/${projectId}/lean/project-charter`)}
            disabled={!canUseLeanTools}
          />
        ) : null}

        {/* PID (standard/pdca only) - optional in Define */}
        {canHavePid ? (
          <ToolCard
            title="PID"
            description="Problem definition, objective and scope (standard/PDCA)."
            status={hasPid ? "created" : "not created"}
            onOpen={() => router.push(`/projects/${projectId}/lean/pid`)}
            disabled={!canUseLeanTools}
          />
        ) : null}

        {/* SIPOC */}
        <ToolCard
          title="SIPOC"
          description="Suppliers • Inputs • Process • Outputs • Customers • Requirements"
          status={`${sipocCount} created`}
          onOpen={() => router.push(`/projects/${projectId}/lean/sipoc`)}
          disabled={!canUseLeanTools}
        />

        {/* Stakeholder analysis */}
        <ToolCard
          title="Stakeholder analysis"
          description="Power / Interest matrix"
          status={`${stakeholderCount} created`}
          onOpen={() => router.push(`/projects/${projectId}/lean/stakeholders`)}
          disabled={!canUseLeanTools}
        />

        <SectionHeader title="Measure" subtitle="Collect data and understand current performance." />
        <div className="text-sm text-gray-500 border rounded-xl p-4">No tools added yet.</div>

<ToolCard
  title="Measurement plan"
  description="CTQ, operational definition, data source, sample size, collector, period and method."
  status={`${measurePlanCount} created`}
  onOpen={() => router.push(`/projects/${projectId}/lean/measure-plan`)}
  disabled={!canUseLeanTools}
/>


        <SectionHeader title="Analyze" subtitle="Identify root causes and key drivers." />

        {/* 5 Whys */}
        <ToolCard
          title="5 Whys"
          description="Root cause analysis"
          status={`${fiveWhysCount} created`}
          onOpen={() => router.push(`/projects/${projectId}/lean/five-whys`)}
          disabled={!canUseLeanTools}
        />

        <SectionHeader title="Improve" subtitle="Design and implement improvements." />
        <div className="text-sm text-gray-500 border rounded-xl p-4">No tools added yet.</div>

        <SectionHeader title="Control" subtitle="Sustain the gains with monitoring and standardization." />
        <div className="text-sm text-gray-500 border rounded-xl p-4">No tools added yet.</div>
      </section>
    </main>
  );
}