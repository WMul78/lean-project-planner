"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";

type Params = { id: string; componentId: string };

type Row = {
  id: string;
  supplier: string | null;
  input: string | null;
  process: string | null;
  output: string | null;
  customer: string | null;
  requirements: string | null;
};

type StepRow = {
  id: string;
  title: string | null;
  order_index: number;
};

export default function SipocDetailPage() {
  const { componentId } = useParams() as Params;
  const [rows, setRows] = useState<Row[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("lean_sipoc_rows")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index");
      const { data: stepData, error: stepErr } = await supabase
        .from("lean_sipoc_steps")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

if (stepErr) throw stepErr;
setSteps((stepData ?? []) as StepRow[]);
      setRows(data ?? []);
    }

    load();
  }, [componentId]);

  
  async function addRow() {
    const { data } = await supabase
      .from("lean_sipoc_rows")
      .insert({ component_id: componentId })
      .select("*")
      .single();

    setRows((prev) => [...prev, data]);
  }

  async function updateRow(id: string, field: keyof Row, value: string) {
    await supabase
      .from("lean_sipoc_rows")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  async function addStep() {
  const nextIndex = steps.length;

  const { data, error } = await supabase
    .from("lean_sipoc_steps")
    .insert({
      component_id: componentId,
      order_index: nextIndex,
      title: `Step ${nextIndex + 1}`,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  setSteps((prev) => [...prev, data as StepRow]);
}

async function updateStep(stepId: string, value: string) {
  const { error } = await supabase
    .from("lean_sipoc_steps")
    .update({ title: value, updated_at: new Date().toISOString() })
    .eq("id", stepId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, title: value } : s)));
}

async function deleteStep(stepId: string) {
  const idx = steps.findIndex((s) => s.id === stepId);
  const removed = steps[idx];
  if (!removed) return;

  const { error } = await supabase.from("lean_sipoc_steps").delete().eq("id", stepId);
  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  // Re-number order_index locally (and in DB) to keep it clean
  const next = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order_index: i }));
  setSteps(next);

  // Persist order_index updates (simple approach)
  await Promise.all(
    next.map((s) =>
      supabase.from("lean_sipoc_steps").update({ order_index: s.order_index }).eq("id", s.id)
    )
  );
}
  const columns = [
    { key: "supplier", label: "Suppliers", color: "bg-green-600" },
    { key: "input", label: "Inputs", color: "bg-red-600" },
    { key: "process", label: "Process", color: "bg-blue-600" },
    { key: "output", label: "Outputs", color: "bg-indigo-600" },
    { key: "customer", label: "Customers", color: "bg-amber-600" },
    { key: "requirements", label: "Requirements", color: "bg-orange-500" },
  ];

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-semibold">SIPOC Diagram</h1>
        <Button onClick={addRow}>Add Row</Button>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {columns.map((col) => (
          <div key={col.key}>
            <div
              className={`${col.color} text-white text-sm font-semibold px-3 py-2 rounded-t-lg`}
            >
              {col.label}
            </div>

            <div className="border rounded-b-lg p-2 min-h-[200px] space-y-2">
              {rows.map((row) => (
                <textarea
                  key={row.id}
                  className="w-full border rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                  value={(row as any)[col.key] ?? ""}
                  onChange={(e) =>
                    updateRow(row.id, col.key as keyof Row, e.target.value)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <section className="mt-8">
  <div className="flex items-center justify-between mb-3">
    <div>
      <div className="text-lg font-semibold">Process steps</div>
      <div className="text-sm text-gray-600">Add steps to describe the high-level process flow.</div>
    </div>
    <Button onClick={addStep}>Add Step</Button>
  </div>

  {/* Horizontal flow (scrollable on mobile) */}
  <div className="overflow-x-auto">
    <div className="flex items-center gap-3 min-w-max py-2">
      {steps.length === 0 ? (
        <div className="text-sm text-gray-500 border rounded-xl p-4">
          No steps yet. Click <span className="font-medium">Add Step</span>.
        </div>
      ) : null}

      {steps.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-3">
          <div className="border rounded-xl px-3 py-2 bg-white shadow-sm w-[220px]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">Step {idx + 1}</div>
              <button
                className="text-xs text-gray-500 hover:text-gray-900"
                onClick={() => deleteStep(s.id)}
                type="button"
                title="Remove step"
              >
                Remove
              </button>
            </div>

            <input
              className="mt-1 w-full border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              value={s.title ?? ""}
              onChange={(e) => updateStep(s.id, e.target.value)}
              placeholder="e.g. Identify critical needs"
            />
          </div>

          {/* Arrow between steps */}
          {idx < steps.length - 1 ? (
            <div className="text-gray-400 select-none">→</div>
          ) : null}
        </div>
      ))}
    </div>
  </div>
</section>
    </main>
  );
}