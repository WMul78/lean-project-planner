"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type Row = {
  id: string;
  component_id: string;
  lesson: string;
  what_happened: string | null;
  recommendation: string | null;
  owner: string | null;
  due_date: string | null; // date as ISO
  status: "open" | "done";
  order_index: number;
};

export default function LessonsLearnedDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [title, setTitle] = useState("Lessons learned");
  const [rows, setRows] = useState<Row[]>([]);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function debounceSave(key: string, fn: () => Promise<void>) {
    const timers = saveTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        console.error("Save failed:", e);
      }
    }, 450);
  }

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const meta = await supabase
        .from("lean_lessons_learned")
        .select("title")
        .eq("component_id", componentId)
        .single();

      if (meta.error) throw meta.error;
      setTitle(meta.data?.title ?? "Lessons learned");

      const rr = await supabase
        .from("lean_lessons_learned_items")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (rr.error) throw rr.error;
      setRows((rr.data ?? []) as Row[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load Lessons learned.");
      router.replace(`/projects/${projectId}/lean/lessons-learned`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  function updateTitleLocal(next: string) {
    setTitle(next);
    debounceSave(`title:${componentId}`, async () => {
      const clean = next.trim() || "Lessons learned";
      const { error } = await supabase
        .from("lean_lessons_learned")
        .update({ title: clean, updated_at: new Date().toISOString() })
        .eq("component_id", componentId);
      if (error) throw error;
    });
  }

  function updateRowLocal(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)));

    debounceSave(`row:${id}`, async () => {
      const { error } = await supabase
        .from("lean_lessons_learned_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    });
  }

  async function addRow() {
    if (!canEdit) {
      alert("Lessons learned is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    const nextIndex = rows.length;

    const { data, error } = await supabase
      .from("lean_lessons_learned_items")
      .insert({
        component_id: componentId,
        lesson: "New lesson",
        status: "open",
        order_index: nextIndex,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setRows((prev) => [...prev, data as Row]);
  }

  async function removeRow(rowId: string) {
    if (!canEdit) return;
    const ok = confirm("Remove this lesson?");
    if (!ok) return;

    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const { error } = await supabase.from("lean_lessons_learned_items").delete().eq("id", rowId);
    if (error) {
      alert(error.message);
      return;
    }

    // Reindex after delete
    const remaining = rows.filter((r) => r.id !== rowId).map((r) => ({ ...r }));
    remaining.sort((a, b) => a.order_index - b.order_index);
    for (let i = 0; i < remaining.length; i++) remaining[i].order_index = i;

    setRows(remaining);

    await Promise.all(
      remaining.map((r) =>
        supabase.from("lean_lessons_learned_items").update({ order_index: r.order_index }).eq("id", r.id)
      )
    );
  }

  const doneCount = useMemo(() => rows.filter((r) => r.status === "done").length, [rows]);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/lessons-learned`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Lessons learned</h1>
          <div className="mt-1 text-xs text-gray-500">
            Plan: {tier} · {doneCount}/{rows.length} done
          </div>
        </div>

        <Button onClick={addRow} disabled={loading || !canEdit}>
          Add lesson
        </Button>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-sm font-medium">Title</div>
            <input
              className="mt-2 w-full border rounded-md px-3 py-2"
              value={title}
              disabled={!canEdit}
              onChange={(e) => updateTitleLocal(e.target.value)}
            />
          </div>

          <div className="border rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-medium">Lessons</div>
              <div className="text-xs text-gray-500">Keep them actionable</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-3 w-[220px]">Lesson</th>
                    <th className="p-3 w-[260px]">What happened</th>
                    <th className="p-3 w-[260px]">Recommendation</th>
                    <th className="p-3 w-[140px]">Owner</th>
                    <th className="p-3 w-[140px]">Due date</th>
                    <th className="p-3 w-[110px]">Status</th>
                    <th className="p-3 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">
                        <input
                          className="w-full border rounded-md px-2 py-2"
                          value={r.lesson ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { lesson: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-full border rounded-md px-2 py-2"
                          value={r.what_happened ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { what_happened: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-full border rounded-md px-2 py-2"
                          value={r.recommendation ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { recommendation: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-full border rounded-md px-2 py-2"
                          value={r.owner ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { owner: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          className="w-full border rounded-md px-2 py-2"
                          value={r.due_date ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { due_date: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full border rounded-md px-2 py-2"
                          value={r.status}
                          disabled={!canEdit}
                          onChange={(e) => updateRowLocal(r.id, { status: e.target.value as Row["status"] })}
                        >
                          <option value="open">Open</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <Button variant="danger" disabled={!canEdit} onClick={() => removeRow(r.id)}>
                          ×
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 ? (
                    <tr>
                      <td className="p-4 text-gray-500" colSpan={7}>
                        No lessons yet. Click <span className="font-medium">Add lesson</span>.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}