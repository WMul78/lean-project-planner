// app/(app)/projects/[id]/lean/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import { loadProjectLean, loadLeanComponent } from "@/app/lib/lean";

type Params = { id: string };

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

  const canUseLeanTools = tier === "pro";
  const canHavePid = projectType === "standard" || projectType === "pdca";
  const canHaveCharter = projectType === "dmaic";

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

        const [pid, charter] = await Promise.all([
          loadLeanComponent(projectId, "pid").catch(() => null),
          loadLeanComponent(projectId, "project_charter").catch(() => null),
        ]);

        if (cancelled) return;
        setHasPid(!!pid);
        setHasCharter(!!charter);
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
          <div className="font-medium text-amber-900">Upgrade to Pro</div>
          <div className="text-sm text-amber-900/80 mt-1">{upsellText}</div>
          <div className="mt-3">
            <Button onClick={() => router.push("/pricing")}>See Pro plan</Button>
          </div>
        </div>
      ) : null}

      <section className="mt-6 grid gap-3">
        {/* PID */}
        {canHavePid ? (
          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">PID (Project Initiation Document)</div>
                <div className="text-sm text-gray-600 mt-1">
                  Define problem, objective, scope, stakeholders and risks.
                </div>
                <div className="text-xs text-gray-500 mt-1">Status: {hasPid ? "created" : "not created"}</div>
              </div>

              <Button
                disabled={!canUseLeanTools}
                onClick={() => router.push(`/projects/${projectId}/lean/pid`)}
              >
                {hasPid ? "Open" : "Create"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Charter */}
        {canHaveCharter ? (
          <div className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Project Charter (DMAIC)</div>
                <div className="text-sm text-gray-600 mt-1">
                  Business case, goal statement, scope and team for DMAIC projects.
                </div>
                <div className="text-xs text-gray-500 mt-1">Status: {hasCharter ? "created" : "not created"}</div>
              </div>

              <Button
                disabled={!canUseLeanTools}
                onClick={() => router.push(`/projects/${projectId}/lean/charter`)}
              >
                {hasCharter ? "Open" : "Create"}
              </Button>
            </div>
          </div>
        ) : null}

        {!canHavePid && !canHaveCharter ? (
          <div className="text-sm text-gray-600">
            No Lean templates available for this project type.
          </div>
        ) : null}
      </section>
    </main>
  );
}
