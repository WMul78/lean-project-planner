"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import { createLeanComponentInstance, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

export default function MeasurePlanListPage() {
  const router = useRouter();
  const { id: projectId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [projectName, setProjectName] = useState("");
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const pr = await loadProjectLean(projectId);
      setProjectName(pr.name ?? "");

      const { data, error } = await supabase
        .from("lean_components")
        .select(
          `
          id,
          created_at,
          lean_measure_plan ( title )
        `
        )
        .eq("project_id", projectId)
        .eq("component_type", "measure_plan")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data ?? []);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load measurement plans.");
      router.replace(`/projects/${projectId}/lean`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createNew() {
    if (!canEdit) {
      alert("Measurement plan is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    try {
      const pr = await loadProjectLean(projectId);
      const comp = await createLeanComponentInstance({ project: pr, componentType: "measure_plan" });
      router.push(`/projects/${projectId}/lean/measure-plan/${comp.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to create measurement plan.");
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Measurement plan</h1>
          <div className="mt-1 text-sm text-gray-600">
            Project: <span className="font-medium text-gray-800">{projectName || projectId}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          
          <Button onClick={createNew} disabled={loading || !canEdit}>
            New measurement plan
          </Button>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-3">
          {items.length === 0 ? (
            <div className="border rounded-xl p-4 text-sm text-gray-600">
              No measurement plans created yet. Click <span className="font-medium">New measurement plan</span>.
            </div>
          ) : null}

          {items.map((it) => {
            const title = it.lean_measure_plan?.title?.trim() || "Measurement plan";
            return (
              <div key={it.id} className="border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-xs text-gray-500">Created: {new Date(it.created_at).toLocaleString()}</div>
                </div>
                <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/measure-plan/${it.id}`)}>
                  Open
                </Button>
              </div>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}