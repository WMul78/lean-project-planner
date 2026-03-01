"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type ImpactItem = {
  id: string;
  component_id: string;
  title: string;
  description: string | null;
  impact: number; // 1..5
  effort: number; // 1..5
  order_index: number;
  updated_at: string;
};

function clamp15(n: number) {
  return Math.max(1, Math.min(5, n));
}

export default function ImpactAnalysisDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [title, setTitle] = useState("Impact analysis");
  const [items, setItems] = useState<ImpactItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  const saveTimers = useRef<Record<string, any>>({});

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      // meta title
      const { data: meta, error: metaErr } = await supabase
        .from("lean_impact_analysis")
        .select("title")
        .eq("component_id", componentId)
        .single();

      if (metaErr) throw metaErr;
      setTitle(meta?.title?.trim() || "Impact analysis");

      // items
      const { data, error } = await supabase
        .from("lean_impact_items")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as ImpactItem[];
      setItems(list);

      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load impact analysis.");
      router.replace(`/projects/${projectId}/lean/impact-analysis`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  async function saveTitleNow(nextTitle: string) {
    const clean = nextTitle.trim() || "Impact analysis";
    setTitle(clean);

    const { error } = await supabase
      .from("lean_impact_analysis")
      .update({ title: clean, updated_at: new Date().toISOString() })
      .eq("component_id", componentId);

    if (error) throw error;
  }

  function updateItemLocal(id: string, patch: Partial<ImpactItem>) {
    setItems((prev) => prev.map((x) => (x.id === id ? ({ ...x, ...patch } as ImpactItem) : x)));

    const timers = saveTimers.current;
    if (timers[id]) clearTimeout(timers[id]);

    timers[id] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("lean_impact_items")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        console.error("Impact item save failed:", e);
      }
    }, 450);
  }

  async function addItem() {
    if (!canEdit) {
      alert("Impact analysis is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    try {
      const nextIndex = items.length;

      const { data, error } = await supabase
        .from("lean_impact_items")
        .insert({
          component_id: componentId,
          title: "New idea",
          description: null,
          impact: 4,
          effort: 2,
          order_index: nextIndex,
        })
        .select("*")
        .single();

      if (error) throw error;

      const next = [...items, data as ImpactItem];
      setItems(next);
      setSelectedId((data as ImpactItem).id);
      setEditorCollapsed(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to add item.");
    }
  }

  async function removeItem(id: string) {
    if (!canEdit) return;
    const ok = confirm("Remove this item?");
    if (!ok) return;

    const { error } = await supabase.from("lean_impact_items").delete().eq("id", id);
    if (error) return alert(error.message);

    const next = items
      .filter((x) => x.id !== id)
      .map((x, idx) => ({ ...x, order_index: idx }));

    setItems(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);

    // keep ordering clean (simple approach like stakeholder page)
    await Promise.all(next.map((x) => supabase.from("lean_impact_items").update({ order_index: x.order_index }).eq("id", x.id)));
  }

  const selected = useMemo(
    () => (selectedId ? items.find((x) => x.id === selectedId) ?? null : null),
    [items, selectedId]
  );

  // quadrant split threshold: >=3 is "high"
  const quadrants = useMemo(() => {
    const q = {
      quickWins: [] as ImpactItem[], // high impact, low effort
      major: [] as ImpactItem[], // high impact, high effort
      fillIns: [] as ImpactItem[], // low impact, low effort
      thankless: [] as ImpactItem[], // low impact, high effort
    };

    for (const it of items) {
      const impactHigh = it.impact >= 3;
      const effortHigh = it.effort >= 3;

      if (impactHigh && !effortHigh) q.quickWins.push(it);
      else if (impactHigh && effortHigh) q.major.push(it);
      else if (!impactHigh && !effortHigh) q.fillIns.push(it);
      else q.thankless.push(it);
    }

    return q;
  }, [items]);

  function NoteCard(props: { it: ImpactItem }) {
    const { it } = props;
    const active = it.id === selectedId;

    return (
      <button
        type="button"
        onClick={() => {
          setSelectedId(it.id);
          setEditorCollapsed(false);
        }}
        className={[
          "text-left w-full border rounded-lg px-3 py-2 bg-white shadow-sm",
          active ? "ring-2 ring-gray-900/20 border-gray-300" : "border-gray-200 hover:border-gray-300",
        ].join(" ")}
        title={`Impact ${it.impact} • Effort ${it.effort}`}
      >
        <div className="text-sm font-medium line-clamp-2">{it.title}</div>
        <div className="text-[11px] text-gray-500 mt-1">
          I {it.impact} • E {it.effort}
        </div>
      </button>
    );
  }

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/impact-analysis`)}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">Impact analysis</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>

          <div className="mt-3">
            <label className="text-xs text-gray-500">Title</label>
            <input
              className="mt-1 w-full max-w-md border rounded-md px-3 py-2"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveTitleNow(title).catch((e) => alert(e?.message ?? "Save failed."))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button onClick={addItem} disabled={!canEdit}>
            Add idea
          </Button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr_340px]">
        {/* Left: list */}
        <div className="border rounded-xl p-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="font-medium">Ideas</div>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setEditorCollapsed((v) => !v)}
            >
              {editorCollapsed ? "Expand editor" : "Collapse editor"}
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500">No items yet.</div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <NoteCard it={it} />
                  </div>
                  <Button variant="danger" disabled={!canEdit} onClick={() => removeItem(it.id)}>
                    ×
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle: matrix */}
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="p-3 border-b">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Impact</span> (low → high) vs <span className="font-medium">Effort</span> (low → high)
            </div>
            <div className="text-xs text-gray-500 mt-1">Tip: select an idea and adjust Impact/Effort to move it.</div>
          </div>

          <div className="grid grid-cols-2 grid-rows-2">
            {/* Quick wins */}
            <div className="p-3 min-h-[280px] bg-indigo-50 border-r border-b">
              <div className="text-sm font-semibold text-indigo-900">Quick wins</div>
              <div className="mt-3 grid gap-2">
                {quadrants.quickWins.map((it) => (
                  <NoteCard key={it.id} it={it} />
                ))}
              </div>
            </div>

            {/* Major projects */}
            <div className="p-3 min-h-[280px] bg-gray-50 border-b">
              <div className="text-sm font-semibold text-gray-900">Major projects</div>
              <div className="mt-3 grid gap-2">
                {quadrants.major.map((it) => (
                  <NoteCard key={it.id} it={it} />
                ))}
              </div>
            </div>

            {/* Fill-ins */}
            <div className="p-3 min-h-[280px] bg-amber-50 border-r">
              <div className="text-sm font-semibold text-amber-900">Fill-ins</div>
              <div className="mt-3 grid gap-2">
                {quadrants.fillIns.map((it) => (
                  <NoteCard key={it.id} it={it} />
                ))}
              </div>
            </div>

            {/* Thankless tasks */}
            <div className="p-3 min-h-[280px] bg-orange-50">
              <div className="text-sm font-semibold text-orange-900">Thankless tasks</div>
              <div className="mt-3 grid gap-2">
                {quadrants.thankless.map((it) => (
                  <NoteCard key={it.id} it={it} />
                ))}
              </div>
            </div>
          </div>

          {/* axis hints */}
          <div className="p-3 border-t text-xs text-gray-500 flex items-center justify-between">
            <div>Effort: low → high</div>
            <div>Impact: low → high</div>
          </div>
        </div>

        {/* Right: editor */}
        <div className={["border rounded-xl p-4 bg-white", editorCollapsed ? "hidden lg:block lg:opacity-50" : ""].join(" ")}>
          <div className="font-medium">Editor</div>
          {!selected ? (
            <div className="mt-3 text-sm text-gray-500">Select an idea to edit.</div>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Title</label>
                <input
                  className="border rounded-md px-3 py-2"
                  value={selected.title}
                  disabled={!canEdit}
                  onChange={(e) => updateItemLocal(selected.id, { title: e.target.value })}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="border rounded-md px-3 py-2 min-h-[90px]"
                  value={selected.description ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => updateItemLocal(selected.id, { description: e.target.value || null })}
                />
              </div>

              <ScoreSlider
                label="Impact"
                value={selected.impact}
                disabled={!canEdit}
                onChange={(v) => updateItemLocal(selected.id, { impact: clamp15(v) })}
              />

              <ScoreSlider
                label="Effort"
                value={selected.effort}
                disabled={!canEdit}
                onChange={(v) => updateItemLocal(selected.id, { effort: clamp15(v) })}
              />

              <div className="text-xs text-gray-500">
                Quadrant rule (MVP): score ≥ 3 = “high”. You can later make this configurable per analysis.
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ScoreSlider(props: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{props.label}</label>
        <div className="text-sm text-gray-700">Score: {props.value}</div>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
}