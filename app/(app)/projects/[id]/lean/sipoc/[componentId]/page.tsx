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

export default function SipocDetailPage() {
  const { componentId } = useParams() as Params;
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("lean_sipoc_rows")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index");

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
    </main>
  );
}