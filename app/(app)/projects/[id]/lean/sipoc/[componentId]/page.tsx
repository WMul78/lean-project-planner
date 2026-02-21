"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const { id: projectId, componentId } = useParams() as any as { id: string; componentId: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const router = useRouter();
  const [rowDrafts, setRowDrafts] = useState<Record<string, Partial<Row>>>({});
  const rowSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  function updateRowLocal(rowId: string, field: keyof Row, value: string) {
  // 1) update drafts immediately (smooth typing)
  setRowDrafts((prev) => ({
    ...prev,
    [rowId]: { ...(prev[rowId] ?? {}), [field]: value },
  }));

  // 2) mirror into rows state (so UI stays consistent)
  setRows((prev) => prev.map((r) => (r.id === rowId ? ({ ...r, [field]: value } as any) : r)));

  // 3) debounce DB save (single row update)
  const timers = rowSaveTimers.current;
  if (timers[rowId]) clearTimeout(timers[rowId]);

  timers[rowId] = setTimeout(async () => {
    try {
      const patch = rowDrafts[rowId] ?? { [field]: value };
      const { error } = await supabase
        .from("lean_sipoc_rows")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", rowId);

      if (error) throw error;
    } catch (e) {
      console.error("Row save failed:", e);
    }
  }, 500);
}

async function saveRowNow(rowId: string) {
  const timers = rowSaveTimers.current;
  if (timers[rowId]) {
    clearTimeout(timers[rowId]);
    delete timers[rowId];
  }

  const patch = rowDrafts[rowId] ?? {};
  const { error } = await supabase
    .from("lean_sipoc_rows")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", rowId);

  if (error) throw error;
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

// --- Debounced step saving (prevents lag & dropped keystrokes) ---
const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});
const stepSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

function getCellValue(row: Row, key: keyof Row) {
  const draft = rowDrafts[row.id]?.[key];
  if (typeof draft === "string") return draft;
  return (row as any)[key] ?? "";
}

function updateStepLocal(stepId: string, value: string) {
  // 1) update drafts immediately (smooth typing)
  setStepDrafts((prev) => ({ ...prev, [stepId]: value }));

  // also mirror into steps list so UI is consistent everywhere
  setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, title: value } : s)));

  // 2) debounce DB save
  const timers = stepSaveTimers.current;
  if (timers[stepId]) clearTimeout(timers[stepId]);

  timers[stepId] = setTimeout(async () => {
    try {
      const { error } = await supabase
        .from("lean_sipoc_steps")
        .update({ title: value, updated_at: new Date().toISOString() })
        .eq("id", stepId);

      if (error) throw error;
    } catch (e: any) {
      console.error("Step save failed:", e);
      // Optional: show toast, but avoid spamming alerts while typing
    }
  }, 500); // tweak: 300-800ms feels good
}

async function saveStepNow(stepId: string) {
  const value = stepDrafts[stepId] ?? steps.find((s) => s.id === stepId)?.title ?? "";

  // cancel pending debounce
  const timers = stepSaveTimers.current;
  if (timers[stepId]) {
    clearTimeout(timers[stepId]);
    delete timers[stepId];
  }

  const { error } = await supabase
    .from("lean_sipoc_steps")
    .update({ title: value, updated_at: new Date().toISOString() })
    .eq("id", stepId);

  if (error) throw error;
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
      <div className="flex items-start justify-between mb-4 gap-3">
  <div>
    <Button
      variant="outline"
      onClick={() => router.push(`/projects/${projectId}/lean/sipoc`)}
    >
      ← Back
    </Button>

    <h1 className="text-2xl font-semibold mt-3">SIPOC Diagram</h1>
    <div className="text-sm text-gray-600 mt-1">
      Define high-level Suppliers, Inputs, Process, Outputs, Customers & Requirements.
    </div>
  </div>

  <div className="flex gap-2">
    <Button onClick={addRow}>Add Row</Button>
  </div>
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
  className="w-full border rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
  value={getCellValue(row, col.key as keyof Row)}
  onChange={(e) => updateRowLocal(row.id, col.key as keyof Row, e.target.value)}
  onBlur={async () => {
    try {
      await saveRowNow(row.id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to save SIPOC row.");
    }
  }}
/>
              ))}
            </div>
          </div>
        ))}
      </div>
<section className="mt-8 border rounded-2xl overflow-hidden">
  {/* Header bar in same style as Process column */}
  <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
    <div>
      <div className="font-semibold">Process flow</div>
      <div className="text-xs text-white/80">
        These steps describe the SIPOC Process at a high level.
      </div>
    </div>
    <Button variant="outline" onClick={addStep}>
      Add Step
    </Button>
  </div>

  <div className="p-4 bg-white">
    <div className="overflow-x-auto">
      <div className="flex items-center gap-3 min-w-max py-2">
        {steps.length === 0 ? (
          <div className="text-sm text-gray-500 border rounded-xl p-4">
            No steps yet. Click <span className="font-medium">Add Step</span>.
          </div>
        ) : null}

        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-3">
            {/* Step pill */}
            <div className="border rounded-2xl px-3 py-2 bg-gray-50 w-[240px] shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">Step {idx + 1}</div>
                <button
                  className="text-xs text-gray-500 hover:text-gray-900"
                  onClick={() => deleteStep(s.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>

              <input
                className="mt-1 w-full border rounded-xl px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                value={stepDrafts[s.id] ?? (s.title ?? "")}
                onChange={(e) => updateStepLocal(s.id, e.target.value)}
                onBlur={async () => {
                  try {
                    await saveStepNow(s.id);
                  } catch (e: any) {
                    console.error(e);
                    alert(e?.message ?? "Failed to save step.");
                  }
                }}
                placeholder="e.g. Identify critical needs"
              />
            </div>

            {/* Arrow */}
            {idx < steps.length - 1 ? (
              <div className="text-gray-400 select-none text-xl leading-none">→</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
    </main>
  );
}