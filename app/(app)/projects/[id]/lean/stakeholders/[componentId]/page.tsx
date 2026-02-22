"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type Stakeholder = {
  id: string;
  component_id: string;
  name: string;
  role: string | null;
  interest: number; // 1..4
  influence: number; // 1..4
  notes: string | null;
  order_index: number;
};

function clamp14(n: number) {
  return Math.max(1, Math.min(4, n));
}

function quadrantLabel(interest: number, influence: number) {
  const iHigh = interest >= 3;
  const pHigh = influence >= 3;

  if (!iHigh && pHigh) return { title: "Influencer", subtitle: "Keep satisfied" };
  if (iHigh && pHigh) return { title: "Key player", subtitle: "Collaborate" };
  if (!iHigh && !pHigh) return { title: "Spectator", subtitle: "Minimal effort" };
  return { title: "Interested", subtitle: "Keep informed" };
}

export default function StakeholderAnalysisDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [title, setTitle] = useState("Stakeholder analysis");
  const [items, setItems] = useState<Stakeholder[]>([]);

  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce saves per stakeholder row
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const meta = await supabase
        .from("lean_stakeholder_analysis")
        .select("*")
        .eq("component_id", componentId)
        .single();

      if (meta.error) throw meta.error;
      setTitle(meta.data?.title ?? "Stakeholder analysis");

      const { data, error } = await supabase
        .from("lean_stakeholders")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as Stakeholder[];
      setItems(list);

      // Auto-select first stakeholder for a better UX
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load stakeholder analysis.");
      router.replace(`/projects/${projectId}/lean/stakeholders`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  // Local update + debounced DB update (smooth typing)
  function updateStakeholderLocal(id: string, patch: Partial<Stakeholder>) {
    setItems((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Stakeholder) : s)));

    const timers = saveTimers.current;
    if (timers[id]) clearTimeout(timers[id]);

    timers[id] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("lean_stakeholders")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        console.error("Stakeholder save failed:", e);
      }
    }, 450);
  }

  async function saveTitleNow(nextTitle: string) {
    const clean = nextTitle.trim() || "Stakeholder analysis";
    setTitle(clean);

    const { error } = await supabase
      .from("lean_stakeholder_analysis")
      .update({ title: clean, updated_at: new Date().toISOString() })
      .eq("component_id", componentId);

    if (error) throw error;
  }

  async function addStakeholder() {
    if (!canEdit) {
      alert("Stakeholder analysis is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    try {
      const nextIndex = items.length;

      const { data, error } = await supabase
        .from("lean_stakeholders")
        .insert({
          component_id: componentId,
          name: "New stakeholder",
          role: null,
          interest: 2,
          influence: 2,
          notes: null,
          order_index: nextIndex,
        })
        .select("*")
        .single();

      if (error) throw error;

      const next = [...items, data as Stakeholder];
      setItems(next);
      setSelectedId((data as Stakeholder).id);
      setEditorCollapsed(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to add stakeholder.");
    }
  }

  async function removeStakeholder(id: string) {
    if (!canEdit) return;

    const { error } = await supabase.from("lean_stakeholders").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    const next = items
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order_index: idx }));

    setItems(next);

    // update selection
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);

    // keep ordering clean (simple approach)
    await Promise.all(
      next.map((s) =>
        supabase.from("lean_stakeholders").update({ order_index: s.order_index }).eq("id", s.id)
      )
    );
  }

  const quadrants = useMemo(() => {
    const q = {
      influencer: [] as Stakeholder[],
      key: [] as Stakeholder[],
      spectator: [] as Stakeholder[],
      interested: [] as Stakeholder[],
    };

    for (const s of items) {
      const iHigh = s.interest >= 3;
      const pHigh = s.influence >= 3;

      if (!iHigh && pHigh) q.influencer.push(s);
      else if (iHigh && pHigh) q.key.push(s);
      else if (!iHigh && !pHigh) q.spectator.push(s);
      else q.interested.push(s);
    }

    return q;
  }, [items]);

  const selected = useMemo(
    () => (selectedId ? items.find((x) => x.id === selectedId) ?? null : null),
    [items, selectedId]
  );

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/stakeholders`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Stakeholder analysis</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Matrix (dominant) */}
          <div className="border rounded-2xl p-4 lg:col-span-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">Power / Interest matrix</div>
                <div className="text-xs text-gray-600 mt-1">Y = Influence (low → high), X = Interest (low → high)</div>
              </div>

              {/* Optional quick access on desktop */}
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-900"
                onClick={() => setEditorCollapsed(false)}
              >
                Edit stakeholders →
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {/* Top-left: Influencer (High influence, Low interest) */}
              <div className="rounded-2xl p-4 text-white bg-green-600 min-h-[220px]">
                <div className="text-lg font-semibold">Influencer</div>
                <div className="text-sm opacity-90 italic">Keep satisfied</div>
                <div className="mt-3 grid gap-2">
                  {quadrants.influencer.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(s.id);
                        setEditorCollapsed(false);
                      }}
                      className="w-full text-left bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2 text-sm"
                      title="Click to edit"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top-right: Key player (High influence, High interest) */}
              <div className="rounded-2xl p-4 text-white bg-orange-500 min-h-[220px]">
                <div className="text-lg font-semibold">Key player</div>
                <div className="text-sm opacity-90 italic">Collaborate</div>
                <div className="mt-3 grid gap-2">
                  {quadrants.key.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(s.id);
                        setEditorCollapsed(false);
                      }}
                      className="w-full text-left bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2 text-sm"
                      title="Click to edit"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom-left: Spectator (Low influence, Low interest) */}
              <div className="rounded-2xl p-4 bg-yellow-300 min-h-[220px]">
                <div className="text-lg font-semibold text-gray-900">Spectator</div>
                <div className="text-sm italic text-gray-800">Minimal effort</div>
                <div className="mt-3 grid gap-2">
                  {quadrants.spectator.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(s.id);
                        setEditorCollapsed(false);
                      }}
                      className="w-full text-left bg-black/10 hover:bg-black/15 rounded-xl px-3 py-2 text-sm text-gray-900"
                      title="Click to edit"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom-right: Interested (Low influence, High interest) */}
              <div className="rounded-2xl p-4 text-white bg-blue-600 min-h-[220px]">
                <div className="text-lg font-semibold">Interested</div>
                <div className="text-sm opacity-90 italic">Keep informed</div>
                <div className="mt-3 grid gap-2">
                  {quadrants.interested.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(s.id);
                        setEditorCollapsed(false);
                      }}
                      className="w-full text-left bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2 text-sm"
                      title="Click to edit"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Axis labels */}
            <div className="mt-4 text-xs text-gray-600 flex items-center justify-between">
              <div>Interest: low</div>
              <div>Interest: high</div>
            </div>
            <div className="mt-2 text-xs text-gray-600">Influence increases upwards</div>
          </div>

          {/* Editor (secondary) */}
          <div className="border rounded-2xl p-4 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">Editor</div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-900"
                onClick={() => setEditorCollapsed((v) => !v)}
              >
                {editorCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>

            {!editorCollapsed ? (
              <>
                {/* Analysis title */}
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Analysis title</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                    value={title}
                    disabled={!canEdit}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={async () => {
                      try {
                        await saveTitleNow(title);
                      } catch (e: any) {
                        console.error(e);
                        alert(e?.message ?? "Failed to save title.");
                      }
                    }}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={addStakeholder} disabled={!canEdit}>
                    Add stakeholder
                  </Button>
                </div>

                {/* Stakeholder list (compact) */}
                <div className="mt-4 grid gap-2 max-h-[36vh] overflow-auto pr-1">
                  {items.length === 0 ? (
                    <div className="text-xs text-gray-500 border rounded-xl p-3">
                      No stakeholders yet.
                    </div>
                  ) : null}

                  {items.map((s) => {
                    const isSelected = selectedId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={[
                          "text-left border rounded-xl p-3 hover:bg-gray-50",
                          isSelected ? "ring-2 ring-gray-200 bg-gray-50" : "",
                        ].join(" ")}
                      >
                        <div className="font-medium text-sm truncate">{s.name}</div>
                        <div className="text-xs text-gray-500 truncate">{s.role ?? "—"}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Interest: {s.interest} • Influence: {s.influence}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected stakeholder editor */}
                {selected ? (
                  <div className="mt-4 border-t pt-4">
                    {(() => {
                      const q = quadrantLabel(selected.interest, selected.influence);

                      return (
                        <div className="grid gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-xs text-gray-600 mb-1">Name</div>
                              <input
                                className="w-full border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                                value={selected.name}
                                disabled={!canEdit}
                                onChange={(e) => updateStakeholderLocal(selected.id, { name: e.target.value })}
                              />
                            </div>

                            <button
                              className="text-xs text-gray-500 hover:text-gray-900 mt-6"
                              type="button"
                              onClick={() => removeStakeholder(selected.id)}
                              disabled={!canEdit}
                            >
                              Remove
                            </button>
                          </div>

                          <div>
                            <div className="text-xs text-gray-600 mb-1">Role</div>
                            <input
                              className="w-full border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                              value={selected.role ?? ""}
                              disabled={!canEdit}
                              onChange={(e) => updateStakeholderLocal(selected.id, { role: e.target.value })}
                              placeholder="Optional"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Interest</div>
                              <select
                                className="w-full border rounded-lg px-2 py-1 text-sm"
                                value={selected.interest}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  updateStakeholderLocal(selected.id, { interest: clamp14(Number(e.target.value)) })
                                }
                              >
                                <option value={1}>Low</option>
                                <option value={2}>Medium</option>
                                <option value={3}>High</option>
                                <option value={4}>Very high</option>
                              </select>
                            </div>

                            <div>
                              <div className="text-xs text-gray-600 mb-1">Influence</div>
                              <select
                                className="w-full border rounded-lg px-2 py-1 text-sm"
                                value={selected.influence}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  updateStakeholderLocal(selected.id, { influence: clamp14(Number(e.target.value)) })
                                }
                              >
                                <option value={1}>Low</option>
                                <option value={2}>Medium</option>
                                <option value={3}>High</option>
                                <option value={4}>Very high</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-600 mb-1">Notes</div>
                            <textarea
                              className="w-full border rounded-lg px-2 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                              rows={3}
                              value={selected.notes ?? ""}
                              disabled={!canEdit}
                              onChange={(e) => updateStakeholderLocal(selected.id, { notes: e.target.value })}
                            />
                          </div>

                          <div className="text-xs text-gray-500">
                            Quadrant: {q.title} — {q.subtitle}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-gray-500">Select a stakeholder to edit details.</div>
                )}
              </>
            ) : (
              <div className="mt-3 text-xs text-gray-500">
                Editor collapsed. Click <span className="font-medium">Expand</span> to edit stakeholders.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}