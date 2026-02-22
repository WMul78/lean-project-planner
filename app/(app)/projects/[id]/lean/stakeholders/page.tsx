"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { createLeanComponentInstance, listLeanComponents, loadProjectLean } from "@/app/lib/lean";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string };

export default function StakeholderAnalysisListPage() {
  const router = useRouter();
  const { id: projectId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [items, setItems] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      // Join title for list display
      const { data, error } = await supabase
        .from("lean_components")
        .select(`
          id,
          created_at,
          lean_stakeholder_analysis ( title )
        `)
        .eq("project_id", projectId)
        .eq("component_type", "stakeholder_analysis")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data ?? []);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load stakeholder analyses.");
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
      alert("Stakeholder analysis is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    try {
      const pr = await loadProjectLean(projectId);
      const comp = await createLeanComponentInstance({ project: pr, componentType: "stakeholder_analysis" });
      router.push(`/projects/${projectId}/lean/stakeholders/${comp.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to create stakeholder analysis.");
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Stakeholder analysis</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <Button onClick={createNew} disabled={loading || !canEdit}>
          New analysis
        </Button>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-3">
          {items.length === 0 ? (
            <div className="border rounded-xl p-4 text-sm text-gray-600">
              No stakeholder analyses yet. Click <span className="font-medium">New analysis</span>.
            </div>
          ) : null}

          {items.map((it) => {
            const title = it.lean_stakeholder_analysis?.title?.trim() || "Stakeholder analysis";
            return (
              <div key={it.id} className="border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="text-xs text-gray-500">Created: {new Date(it.created_at).toLocaleString()}</div>
                </div>
                <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/stakeholders/${it.id}`)}>
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