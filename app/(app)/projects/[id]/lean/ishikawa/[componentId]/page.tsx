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

  const [sidebarHidden, setSidebarHidden] = useState(false);

  const [problem, setProblem] = useState("Define the problem");
  const [categories, setCategories] = useState<Category[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [openCatId, setOpenCatId] = useState<string | null>(null);

  // Debounce saves per key
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);

      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      // 1) Load meta
      const meta = await supabase
        .from("lean_ishikawa")
        .select("problem_statement")
        .eq("component_id", componentId)
        .single();

      if (meta.error) throw meta.error;

      setProblem(meta.data?.problem_statement ?? "Define the problem");

      // 2) Load categories
      const catRes = await supabase
        .from("lean_ishikawa_categories")
        .select("*")
        .eq("component_id", componentId)
        .order("order_index", { ascending: true });

      if (catRes.error) throw catRes.error;

      const catList = (catRes.data ?? []) as Category[];
      setCategories(catList);

      // Open first category by default
      if (!openCatId && catList.length > 0) setOpenCatId(catList[0].id);

      // 3) Load causes for these categories
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

  function updateCauseLocal(id: string, patch: Partial<Cause>) {
    setCauses((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...patch } as Cause) : c)));

    debounceSave(`cause:${id}`, async () => {
      const { error } = await supabase.from("lean_ishikawa_causes").update({ ...patch }).eq("id", id);
      if (error) throw error;
    });
  }

  async function addCause(categoryId: string) {
    if (!canEdit) {
      alert("Ishikawa is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    const existing = causes.filter((c) => c.category_id === categoryId).sort((a, b) => a.order_index - b.order_index);
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
      console.error(error);
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
      console.error(error);
      alert(error.message);
      return;
    }

    // Remove locally and reindex in that category
    const catId = row.category_id;

    const remaining = causes.filter((c) => c.id !== causeId);
    const reindexedInCat = remaining
      .filter((c) => c.category_id === catId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((c, idx) => ({ ...c, order_index: idx }));

    const next = remaining.map((c) => {
      const rr = reindexedInCat.find((x) => x.id === c.id);
      return rr ? rr : c;
    });

    setCauses(next);

    // Persist reindex (simple approach)
    await Promise.all(
      reindexedInCat.map((c) => supabase.from("lean_ishikawa_causes").update({ order_index: c.order_index }).eq("id", c.id))
    );
  }

  const grouped = useMemo(() => {
    const byCat: Record<string, Cause[]> = {};
    for (const c of causes) {
      if (!byCat[c.category_id]) byCat[c.category_id] = [];
      byCat[c.category_id].push(c);
    }
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
        <section
          className={[
            "mt-6 grid gap-4",
            sidebarHidden ? "grid-cols-1" : "lg:grid-cols-[360px_1fr]",
          ].join(" ")}
        >
          {/* Left: inputs (hideable) */}
          {!sidebarHidden ? (
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
          ) : null}

          {/* Right: diagram */}
          <div className="border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Diagram</div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 hidden sm:block">Auto-generated from your inputs</div>

                <Button variant="outline" type="button" onClick={() => setSidebarHidden((v) => !v)}>
                  {sidebarHidden ? "Show inputs" : "Hide inputs"}
                </Button>
              </div>
            </div>

            <div className={["mt-4 border rounded-xl bg-gray-50", sidebarHidden ? "p-1" : "p-3"].join(" ")}>
              <IshikawaDiagram
                problem={problem}
                categories={grouped.map((c) => ({
                  name: c.name,
                  causes: c.causes.map((x) => x.description),
                }))}
              />
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: keep cause texts short. (MVP diagram renders up to 6 causes per category.)
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

/**
 * Classic Ishikawa (Fishbone) renderer (head on the right).
 * - Bones go "backwards" (to the left) from the spine (like a real Ishikawa).
 * - Category labels are in boxes.
 * - Causes are drawn as horizontal lines ending on the category bone (with arrow).
 * - Robust layout: fixed columns + fixed slots.
 */
function IshikawaDiagram(props: {
  problem: string;
  categories: { name: string; causes: string[] }[];
}) {
  // Canvas
  const width = 1500;
  const height = 650;

  // Spine (ruggengraat)
  const spineY = height / 2;
  const spineStartX = 120;
  const spineEndX = 1060; // before the problem box

  // Problem box (vissekop)
  const headX = 1100;
  const headW = 320;
  const headH = 150;

  // Category bone geometry (backwards)
  // Anchor = on spine; End = left/up or left/down
  const boneLenX = 260; // how far left the bone end is
  const boneLenY = 210; // how far up/down the bone end is

  // We place bones in 3 columns (classic)
  const columns = 3;
  const colXs = Array.from({ length: columns }, (_, i) => {
    const t = (i + 1) / (columns + 1); // 0.25, 0.5, 0.75
    return spineStartX + (spineEndX - spineStartX) * t;
  });

  // Category box style
  const catBoxW = 170;
  const catBoxH = 46;

  // Cause lines
  const maxCauses = 6; // keep it stable in diagram
  const causeLineStartX = 80; // where the horizontal cause lines begin
  const causeTextX = 30;      // text anchor position (left)
  const fontSize = 12;

  // Slots along each bone (0..1 from spine anchor to bone end)
  // Spread them so they don't cluster near the spine.
  const slots = [0.22, 0.34, 0.46, 0.58, 0.70, 0.82];

  // Helpers
  function clampText(s: string, n: number) {
    const t = (s || "").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function wrapTwoLines(text: string, maxCharsPerLine: number) {
    const words = (text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];

    const lines: string[] = [];
    let current = "";

    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (next.length <= maxCharsPerLine) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = w;
        if (lines.length === 2) break;
      }
    }
    if (lines.length < 2 && current) lines.push(current);

    if (lines.length === 2) lines[1] = clampText(lines[1], maxCharsPerLine);
    if (lines.length === 1) lines[0] = clampText(lines[0], maxCharsPerLine);

    return lines;
  }

  const problem = (props.problem || "Define the problem").trim();
  const cats = (props.categories ?? []).map((c) => ({
    name: (c.name || "").trim() || "Category",
    causes: (c.causes ?? []).map((x) => (x || "").trim()).filter(Boolean).slice(0, maxCauses),
  }));

  // We keep your existing order (alternating top/bottom):
  // index 0 top col0, 1 bottom col0, 2 top col1, 3 bottom col1, 4 top col2, 5 bottom col2, ...
  // If you always have exactly 6 categories this matches the classic layout nicely.
  function getColIndex(i: number) {
    return Math.floor(i / 2); // 0,0,1,1,2,2,...
  }
  function isTop(i: number) {
    return i % 2 === 0;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Arrow marker */}
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="black" />
        </marker>
      </defs>

      {/* Spine */}
      <line x1={spineStartX} y1={spineY} x2={spineEndX} y2={spineY} stroke="black" strokeWidth="2" />

      {/* Problem head */}
      <rect x={headX} y={spineY - headH / 2} width={headW} height={headH} fill="#fff" stroke="black" />
      <text x={headX + headW / 2} y={spineY - 20} textAnchor="middle" fontSize="16" fontWeight="700">
        Problem
      </text>
      <text x={headX + headW / 2} y={spineY + 16} textAnchor="middle" fontSize="14">
        {clampText(problem || "Define the problem", 44)}
      </text>

      {/* Small label */}
      <text x={spineStartX} y={spineY - 12} fontSize="10" fill="#444">
        Causes →
      </text>

      {cats.map((cat, i) => {
        const col = Math.min(columns - 1, getColIndex(i)); // safety
        const ax = colXs[col]; // anchor on spine
        const ay = spineY;

        // Bone end goes backwards (to the left)
        const bx = ax - boneLenX;
        const by = isTop(i) ? spineY - boneLenY : spineY + boneLenY;

        // Category box near bone end
        const boxX = bx - catBoxW / 2;
        const boxY = by - (isTop(i) ? catBoxH + 14 : -14); // above for top, below for bottom

        return (
          <g key={`${cat.name}-${i}`}>
            {/* Bone (diagonal) */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="black" strokeWidth="2" />

            {/* Category box */}
            <rect x={boxX} y={boxY} width={catBoxW} height={catBoxH} fill="#fff" stroke="black" />
            <text
              x={boxX + catBoxW / 2}
              y={boxY + catBoxH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="13"
              fontWeight="700"
            >
              {clampText(cat.name, 18)}
            </text>

            {/* Causes as horizontal lines pointing to the bone */}
            {cat.causes.map((cause, idx) => {
              const t = slots[idx] ?? slots[slots.length - 1];

              // Point on bone at slot t
              const px = lerp(ax, bx, t);
              const py = lerp(ay, by, t);

              // Horizontal line should end near the bone (px,py)
              // Start is fixed left; ensure we don't go past the end.
              const x2 = px - 6;
              const x1 = Math.min(x2 - 40, causeLineStartX); // keep a minimum line length
              const y = py;

              // Text near the left
              const lines = wrapTwoLines(cause, 26);

              return (
                <g key={idx}>
                  {/* Cause line with arrow toward bone */}
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="black"
                    strokeWidth="1.6"
                    markerEnd="url(#arrow)"
                  />

                  {/* Cause text */}
                  <text x={causeTextX} y={y - 4} fontSize={fontSize} textAnchor="start">
                    <tspan x={causeTextX} dy="0">
                      {lines[0]}
                    </tspan>
                    {lines[1] ? (
                      <tspan x={causeTextX} dy="14">
                        {lines[1]}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}