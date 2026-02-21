"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { ensureLeanComponent, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

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

function ChevronRow(props: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  indent: number; // 0..5
  variant: "problem" | "why" | "root";
}) {
  const { variant } = props;

  const leftBg =
    variant === "problem" ? "bg-rose-500" : variant === "root" ? "bg-rose-500" : "bg-amber-500";
  const rightBg =
    variant === "problem" ? "bg-rose-600" : variant === "root" ? "bg-rose-600" : "bg-emerald-500";

  const readOnly = !props.onChange;

  return (
    <div className="w-full" style={{ marginLeft: `${props.indent * 18}px` }}>
      <div className="flex items-stretch w-full max-w-[760px]">
        {/* Left "tag" */}
        <div
          className={[
            leftBg,
            "text-white text-sm font-semibold px-4 py-3 rounded-l-xl",
            "flex items-center justify-center min-w-[92px]",
          ].join(" ")}
        >
          {props.label}
        </div>

        {/* Right chevron input */}
        <div className="relative flex-1">
          {/* Chevron shape (triangle end) */}
          <div
            className={[
              rightBg,
              "absolute inset-0 rounded-r-xl",
              "after:content-[''] after:absolute after:top-0 after:right-[-18px]",
              "after:w-0 after:h-0 after:border-t-[26px] after:border-b-[26px] after:border-l-[18px]",
              // Make the triangle match the rightBg via inline style below
            ].join(" ")}
            style={
              {
                // The triangle uses border-left-color; Tailwind can't bind dynamic class easily
                ["--chev" as any]: "transparent",
              } as any
            }
          />

          {/* Input overlay */}
          {readOnly ? (
            <div className="relative z-10 px-4 py-3 text-white text-sm">
              {props.value || <span className="opacity-70">—</span>}
            </div>
          ) : (
            <input
              className={[
                "relative z-10 w-full bg-transparent px-4 py-3 text-sm text-white",
                "placeholder:text-white/70 focus:outline-none",
              ].join(" ")}
              value={props.value}
              onChange={(e) => props.onChange?.(e.target.value)}
              disabled={props.disabled}
              placeholder="Type here…"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function FiveWhysPage() {
  const router = useRouter();
  const params = useParams() as any as Params;
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<"standard" | "pdca" | "dmaic">("standard");

  // 5 Whys is useful for all types; only Pro-gated
  const allowed = useMemo(() => true, []);
  const [componentId, setComponentId] = useState<string | null>(null);

  // fields
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
        setProjectType(pr.project_type);

        // Ensure component exists (will fail on Free/Core due to RLS – same pattern as PID/Charter)
        const comp = await ensureLeanComponent({ project: pr, componentType: "five_whys" });
        if (cancelled) return;

        setComponentId(comp.id);

        const { data, error } = await supabase
          .from("lean_five_whys")
          .select("*")
          .eq("component_id", comp.id)
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
        console.error("5 Whys load failed:", e);
        alert(e?.message ?? "Failed to load 5 Whys. If you are not on Pro, upgrade to use Lean tools.");
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
      alert("5 Whys is available on the Pro plan.");
      router.push("/pricing");
      return;
    }
    if (!componentId) return;
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

      // touch lean_components updated_at (optional but nice)
      await supabase
        .from("lean_components")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", componentId);

      alert("Saved.");
    } catch (e: any) {
      console.error("5 Whys save failed:", e);
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
          <h1 className="text-2xl font-semibold mt-3">5 Whys</h1>
          <div className="mt-1 text-sm text-gray-600">
            Project: <span className="font-medium text-gray-800">{projectName || projectId}</span> • type:{" "}
            <span className="font-medium text-gray-800">{projectType}</span>
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

      {!loading && allowed ? (
        <section className="mt-8">
          <div className="text-sm text-gray-600 mb-4">
            Fill in the problem, then answer “Why?” step-by-step. Optionally set a Root cause at the end.
          </div>

          <div className="grid gap-3">
            <ChevronRow
              label="Problem"
              value={problem}
              onChange={setProblem}
              disabled={!canEdit}
              indent={0}
              variant="problem"
            />

            <ChevronRow label="Why?" value={why1} onChange={setWhy1} disabled={!canEdit} indent={1} variant="why" />
            <ChevronRow label="Why?" value={why2} onChange={setWhy2} disabled={!canEdit} indent={2} variant="why" />
            <ChevronRow label="Why?" value={why3} onChange={setWhy3} disabled={!canEdit} indent={3} variant="why" />
            <ChevronRow label="Why?" value={why4} onChange={setWhy4} disabled={!canEdit} indent={4} variant="why" />
            <ChevronRow label="Why?" value={why5} onChange={setWhy5} disabled={!canEdit} indent={5} variant="why" />

            <div className="mt-2" />
            <ChevronRow
              label="Root"
              value={rootCause}
              onChange={setRootCause}
              disabled={!canEdit}
              indent={4}
              variant="root"
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}