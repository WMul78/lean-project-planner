"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type FiveWhysRow = {
  component_id: string;
  problem_statement: string | null;
  why_1: string | null;
  why_2: string | null;
  why_3: string | null;
  why_4: string | null;
  why_5: string | null;
  root_cause: string | null;
};

function txt(v: string | null | undefined) {
  return (v ?? "").toString();
}

function PillRow(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  indent: number;
  variant: "problem" | "why" | "root";
  placeholder?: string;
}) {
  const leftBg = props.variant === "why" ? "bg-amber-500" : "bg-rose-500";
  const rightBg = props.variant === "why" ? "bg-emerald-500" : "bg-rose-600";

  return (
    <div className="w-full" style={{ marginLeft: `${props.indent * 16}px` }}>
      <div className="flex items-stretch w-full max-w-[820px] overflow-hidden rounded-xl">
        <div
          className={[
            leftBg,
            "text-white text-sm font-semibold px-4 py-3",
            "flex items-center justify-center min-w-[96px]",
          ].join(" ")}
        >
          {props.label}
        </div>

        <div className="relative flex-1">
          <div className={[rightBg, "absolute inset-0"].join(" ")} />
          <input
            className={[
              "relative z-10 w-full bg-transparent px-4 py-3 text-sm text-white",
              "placeholder:text-white/70 focus:outline-none",
            ].join(" ")}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            disabled={props.disabled}
            placeholder={props.placeholder ?? "Type here…"}
          />
        </div>
      </div>
    </div>
  );
}

export default function FiveWhysDetailPage() {
  const router = useRouter();
  const params = useParams() as any as Params;
  const projectId = params.id;
  const componentId = params.componentId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [projectName, setProjectName] = useState("");

  const [problem, setProblem] = useState("");
  const [why1, setWhy1] = useState("");
  const [why2, setWhy2] = useState("");
  const [why3, setWhy3] = useState("");
  const [why4, setWhy4] = useState("");
  const [why5, setWhy5] = useState("");
  const [rootCause, setRootCause] = useState("");

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

        const { data, error } = await supabase
          .from("lean_five_whys")
          .select("*")
          .eq("component_id", componentId)
          .single();

        if (error) throw error;

        const row = data as any as FiveWhysRow;
        setProblem(txt(row.problem_statement));
        setWhy1(txt(row.why_1));
        setWhy2(txt(row.why_2));
        setWhy3(txt(row.why_3));
        setWhy4(txt(row.why_4));
        setWhy5(txt(row.why_5));
        setRootCause(txt(row.root_cause));
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Failed to load this 5 Whys.");
        router.replace(`/projects/${projectId}/lean/five-whys`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, componentId, router]);

  async function save() {
    if (!canEdit) {
      alert("5 Whys is available on the Pro plan.");
      router.push("/pricing");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("lean_five_whys")
        .update({
          problem_statement: problem.trim() || null,
          why_1: why1.trim() || null,
          why_2: why2.trim() || null,
          why_3: why3.trim() || null,
          why_4: why4.trim() || null,
          why_5: why5.trim() || null,
          root_cause: rootCause.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("component_id", componentId);

      if (error) throw error;

      await supabase
        .from("lean_components")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", componentId);

      alert("Saved.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/five-whys`)}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">5 Whys</h1>
          <div className="mt-1 text-sm text-gray-600">
            Project: <span className="font-medium text-gray-800">{projectName || projectId}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button onClick={save} disabled={loading || saving || !canEdit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-8">
          <div className="text-sm text-gray-600 mb-4">
            Fill in the problem, then answer “Why?” step-by-step. Optionally set a Root cause at the end.
          </div>

          <div className="grid gap-3">
            <PillRow label="Problem" value={problem} onChange={setProblem} disabled={!canEdit} indent={0} variant="problem" />
            <PillRow label="Why?" value={why1} onChange={setWhy1} disabled={!canEdit} indent={1} variant="why" />
            <PillRow label="Why?" value={why2} onChange={setWhy2} disabled={!canEdit} indent={2} variant="why" />
            <PillRow label="Why?" value={why3} onChange={setWhy3} disabled={!canEdit} indent={3} variant="why" />
            <PillRow label="Why?" value={why4} onChange={setWhy4} disabled={!canEdit} indent={4} variant="why" />
            <PillRow label="Why?" value={why5} onChange={setWhy5} disabled={!canEdit} indent={5} variant="why" />
            <div className="mt-2" />
            <PillRow label="Root cause" value={rootCause} onChange={setRootCause} disabled={!canEdit} indent={4} variant="root" />
          </div>
        </section>
      ) : null}
    </main>
  );
}