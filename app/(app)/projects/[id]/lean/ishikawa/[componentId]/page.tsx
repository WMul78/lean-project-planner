"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

type Category = {
  id: string;
  component_id: string;
  name: string;
  order_index: number;
};

type Cause = {
  id: string;
  category_id: string;
  description: string;
  order_index: number;
};

export default function IshikawaDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [problem, setProblem] = useState("Define the problem");
  const [categories, setCategories] = useState<Category[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [openCatId, setOpenCatId] = useState<string | null>(null);

  // Debounce saves per row
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const meta = await supabase
        .from("lean_ishikawa")
        .select("problem_statement")
        .eq("component_id", componentId)
        .single();

      if (meta.error) throw meta.error;
      setProblem(meta.data?.problem_statement ?? "Define the problem");

      const catRes = await supabase
        .from("lean_ishikawa_categories")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (catRes.error) throw catRes.error;
      const catList = (catRes.data ?? []) as Category[];
      setCategories(catList);

      // auto open first category for UX
      if (!openCatId && catList.length > 0) setOpenCatId(catList[0].id);

      // Load all causes for these categories
      const ids = catList.map((c) => c.id);
      if (ids.length === 0) {
        setCauses([]);
      } else {
        const causeRes = await supabase
          .from("lean_ishikawa_causes")
          .select("*")
          .in("category_id", ids)
          .order("order_index", { ascending: true });

        if (causeRes.error) throw causeRes.error;
        setCauses((causeRes.data ?? []) as Cause[]);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load Ishikawa.");
      router.replace(`/projects/${projectId}/lean/ishikawa`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

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

  function updateCauseLocal(id: string, patch: Partial<Cause>) {
    setCauses((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...patch } as Cause) : c)));

    debounceSave(`cause:${id}`, async () => {
      const { error } = await supabase
        .from("lean_ishikawa_causes")
        .update({ ...patch })
        .eq("id", id);
      if (error) throw error;
    });
  }

  function updateProblemLocal(next: string) {
    setProblem(next);
    debounceSave(`problem:${componentId}`, async () => {
      const clean = (next ?? "").trim() || "Define the problem";
      const { error } = await supabase
        .from("lean_ishikawa")
        .update({ problem_statement: clean, updated_at: new Date().toISOString() })
        .eq("component_id", componentId);
      if (error) throw error;
    });
  }

  async function addCause(categoryId: string) {
    if (!canEdit) {
      alert("Ishikawa is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    const existing = causes.filter((c) => c.category_id === categoryId);
    const nextIndex = existing.length;

    const { data, error } = await supabase
      .from("lean_ishikawa_causes")
      .insert({
        category_id: categoryId,
        description: "New cause",
        order_index: nextIndex,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setCauses((prev) => [...prev, data as Cause]);
  }

  async function removeCause(causeId: string) {
    if (!canEdit) return;
    const ok = confirm("Remove this cause?");
    if (!ok) return;

    const row = causes.find((c) => c.id === causeId);
    if (!row) return;

    const { error } = await supabase.from("lean_ishikawa_causes").delete().eq("id", causeId);
    if (error) {
      alert(error.message);
      return;
    }

    // reindex within the category (simple approach)
    const next = causes
      .filter((c) => c.id !== causeId)
      .map((c) => ({ ...c }));

    const cat = row.category_id;
    const inCat = next.filter((c) => c.category_id === cat).sort((a, b) => a.order_index - b.order_index);
    for (let i = 0; i < inCat.length; i++) inCat[i].order_index = i;

    setCauses(next);

    await Promise.all(
      inCat.map((c) =>
        supabase.from("lean_ishikawa_causes").update({ order_index: c.order_index }).eq("id", c.id)
      )
    );
  }

  const grouped = useMemo(() => {
    const byCat: Record<string, Cause[]> = {};
    for (const c of causes) {
      if (!byCat[c.category_id]) byCat[c.category_id] = [];
      byCat[c.category_id].push(c);
    }
    // stable order
    for (const k of Object.keys(byCat)) {
      byCat[k].sort((a, b) => a.order_index - b.order_index);
    }

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      causes: byCat[cat.id] ?? [],
    }));
  }, [categories, causes]);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/ishikawa`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">Ishikawa (Fishbone)</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Left: accordion + inputs */}
          <div className="border rounded-xl p-4 bg-white">
            <div className="font-medium">Problem</div>
            <input
              className="mt-2 w-full border rounded-md px-3 py-2"
              value={problem}
              disabled={!canEdit}
              onChange={(e) => updateProblemLocal(e.target.value)}
              placeholder="e.g. Missed deadline"
            />

            <div className="mt-6 flex items-center justify-between">
              <div className="font-medium">Categories</div>
              <div className="text-xs text-gray-500">Click to expand</div>
            </div>

            <div className="mt-3 grid gap-2">
              {grouped.map((cat) => {
                const open = openCatId === cat.id;
                return (
                  <div key={cat.id} className="border rounded-xl overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                      onClick={() => setOpenCatId(open ? null : cat.id)}
                    >
                      <div className="text-sm font-semibold">{cat.name}</div>
                      <div className="text-xs text-gray-500">{open ? "Hide" : "Show"}</div>
                    </button>

                    {open ? (
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">{cat.causes.length} causes</div>
                          <Button onClick={() => addCause(cat.id)} disabled={!canEdit}>
                            Add cause
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {cat.causes.length === 0 ? (
                            <div className="text-sm text-gray-500 border rounded-lg p-2">
                              No causes yet. Click <span className="font-medium">Add cause</span>.
                            </div>
                          ) : null}

                          {cat.causes.map((c) => (
                            <div key={c.id} className="flex gap-2 items-start">
                              <input
                                className="flex-1 border rounded-md px-2 py-2 text-sm"
                                value={c.description}
                                disabled={!canEdit}
                                onChange={(e) => updateCauseLocal(c.id, { description: e.target.value })}
                              />
                              <Button variant="danger" disabled={!canEdit} onClick={() => removeCause(c.id)}>
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: fishbone diagram */}
          <div className="border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Diagram</div>
              <div className="text-xs text-gray-500">Auto-generated from your inputs</div>
            </div>

            <div className="mt-4 border rounded-xl p-3 bg-gray-50">
              <IshikawaDiagram
                problem={problem}
                categories={grouped.map((c) => ({
                  name: c.name,
                  causes: c.causes.map((x) => x.description),
                }))}
              />
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: keep cause texts short. (MVP diagram renders up to 5 causes per category.)
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function IshikawaDiagram(props: {
  problem: string;
  categories: { name: string; causes: string[] }[];
}) {
  const width = 1100;
  const height = 520;
  const centerY = height / 2;

  const problem = (props.problem || "Define the problem").slice(0, 40);
  const cats = props.categories ?? [];

  // We place categories alternating top/bottom, left-to-right
  const cols = Math.ceil(cats.length / 2);
  const colWidth = 220;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Main spine */}
      <line x1="60" y1={centerY} x2="880" y2={centerY} stroke="black" strokeWidth="2" />

      {/* Problem box */}
      <rect x="900" y={centerY - 50} width="180" height="100" fill="#fff" stroke="black" />
      <text x="990" y={centerY - 10} textAnchor="middle" fontSize="14" fontWeight="600">
        Problem
      </text>
      <text x="990" y={centerY + 15} textAnchor="middle" fontSize="12">
        {problem}
      </text>

      {cats.map((cat, index) => {
        const isTop = index % 2 === 0;
        const col = Math.floor(index / 2);

        // anchor on spine
        const x1 = 160 + col * colWidth;
        const y1 = centerY;

        // end of bone
        const x2 = x1 + 130;
        const y2 = isTop ? centerY - 150 : centerY + 150;

        const labelX = x2 + 10;
        const labelY = y2;

        const causes = (cat.causes ?? []).slice(0, 5);

        return (
          <g key={`${cat.name}-${index}`}>
            {/* diagonal bone */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" strokeWidth="2" />

            {/* category label */}
            <text x={labelX} y={labelY} fontSize="13" fontWeight="600" dominantBaseline="middle">
              {cat.name}
            </text>

            {/* causes (rendered near bone end) */}
            {causes.map((c, i) => {
              const txt = (c || "").trim();
              if (!txt) return null;

              const dy = 18 * (i + 1);
              const y = isTop ? labelY - dy : labelY + dy;
              return (
                <text key={i} x={labelX} y={y} fontSize="11">
                  • {txt.slice(0, 55)}
                </text>
              );
            })}
          </g>
        );
      })}

      {/* Axis labels */}
      <text x="65" y={centerY - 10} fontSize="10" fill="#555">
        Causes →
      </text>
    </svg>
  );
}