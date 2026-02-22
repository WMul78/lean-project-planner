"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type Row = {
  id: string;
  component_id: string;
  ctq: string;
  operational_definition: string | null;
  data_source_location: string | null;
  sample_size: string | null;
  data_collector: string | null;
  measurement_period: string | null;
  data_collection_method: string | null;
  extra_data: string | null;
  order_index: number;
  created_at?: string;
};

export default function MeasurePlanDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [title, setTitle] = useState("Measurement plan");
  const [rows, setRows] = useState<Row[]>([]);

  // Debounce timers per row+field
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const meta = await supabase
        .from("lean_measure_plan")
        .select("*")
        .eq("component_id", componentId)
        .single();

      if (meta.error) throw meta.error;
      setTitle(meta.data?.title ?? "Measurement plan");

      const { data, error } = await supabase
        .from("lean_measure_plan_rows")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load measurement plan.");
      router.replace(`/projects/${projectId}/lean/measure-plan`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  function updateCellLocal(rowId: string, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? ({ ...r, [field]: value } as any) : r)));

    const key = `${rowId}:${String(field)}`;
    if (timers.current[key]) clearTimeout(timers.current[key]);

    // Save only the changed field (avoids stale state issues)
    timers.current[key] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("lean_measure_plan_rows")
          .update({ [field]: value, updated_at: new Date().toISOString() } as any)
          .eq("id", rowId);

        if (error) throw error;
      } catch (e) {
        console.error("Cell save failed:", e);
      }
    }, 450);
  }

  async function saveTitleNow() {
    const clean = title.trim() || "Measurement plan";
    setTitle(clean);

    const { error } = await supabase
      .from("lean_measure_plan")
      .update({ title: clean, updated_at: new Date().toISOString() })
      .eq("component_id", componentId);

    if (error) throw error;
  }

  async function addRow() {
    if (!canEdit) {
      alert("Measurement plan is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    const nextIndex = rows.length;

    const { data, error } = await supabase
      .from("lean_measure_plan_rows")
      .insert({
        component_id: componentId,
        ctq: "New CTQ",
        operational_definition: null,
        data_source_location: null,
        sample_size: null,
        data_collector: null,
        measurement_period: null,
        data_collection_method: null,
        extra_data: null,
        order_index: nextIndex,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setRows((prev) => [...prev, data as Row]);
  }

  async function deleteRow(rowId: string) {
    if (!canEdit) return;

    const { error } = await supabase.from("lean_measure_plan_rows").delete().eq("id", rowId);
    if (error) {
      alert(error.message);
      return;
    }

    // Reindex
    const next = rows.filter((r) => r.id !== rowId).map((r, idx) => ({ ...r, order_index: idx }));
    setRows(next);

    await Promise.all(
      next.map((r) => supabase.from("lean_measure_plan_rows").update({ order_index: r.order_index }).eq("id", r.id))
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/measure-plan`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Measurement plan</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button onClick={addRow} disabled={loading || !canEdit}>
            Add row
          </Button>
        </div>
      </header>

      {!loading ? (
        <section className="mt-6">
          <div className="border rounded-2xl p-4">
            <div className="text-xs text-gray-600 mb-1">Title</div>
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={async () => {
                try {
                  await saveTitleNow();
                } catch (e: any) {
                  alert(e?.message ?? "Failed to save title.");
                }
              }}
            />
          </div>

          <div className="mt-4 overflow-x-auto border rounded-2xl">
            <table className="min-w-[1500px] w-full text-sm">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="p-3 text-left">CTQ</th>
                  <th className="p-3 text-left">Operational definition (UDMO)</th>
                  <th className="p-3 text-left">Data source & location</th>
                  <th className="p-3 text-left">Sample size</th>
                  <th className="p-3 text-left">Who collects data?</th>
                  <th className="p-3 text-left">Measurement period</th>
                  <th className="p-3 text-left">How is data collected?</th>
                  <th className="p-3 text-left">Extra data</th>
                  <th className="p-3 text-left w-[90px]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    {(
                      [
                        ["ctq", r.ctq],
                        ["operational_definition", r.operational_definition ?? ""],
                        ["data_source_location", r.data_source_location ?? ""],
                        ["sample_size", r.sample_size ?? ""],
                        ["data_collector", r.data_collector ?? ""],
                        ["measurement_period", r.measurement_period ?? ""],
                        ["data_collection_method", r.data_collection_method ?? ""],
                        ["extra_data", r.extra_data ?? ""],
                      ] as Array<[keyof Row, string]>
                    ).map(([field, value]) => (
                      <td key={String(field)} className="p-2 align-top">
                        <textarea
                          className="w-full min-h-[76px] border rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                          value={value}
                          disabled={!canEdit}
                          onChange={(e) => updateCellLocal(r.id, field, e.target.value)}
                        />
                      </td>
                    ))}

                    <td className="p-2 align-top">
                      <Button variant="danger" onClick={() => deleteRow(r.id)} disabled={!canEdit}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={9}>
                      No rows yet. Click “Add row”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="mt-6 text-sm text-gray-500">Loading…</div>
      )}
    </main>
  );
}