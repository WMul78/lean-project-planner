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
 * Robust Ishikawa (Fishbone) SVG renderer.
 * Key improvements:
 * - Cause ribs are drawn PERPENDICULAR to the category bone (prevents crossing near the spine)
 * - Fixed slot positions along each bone (stable layout)
 * - 2-line text wrapping (reduces overlap)
 * - Larger left margin to keep labels inside the viewBox
 */
function IshikawaDiagram(props: {
  problem: string;
  categories: { name: string; causes: string[] }[];
}) {
  // Bigger canvas = more breathing room
  const width = 1400;
  const height = 620;

  const spineY = height / 2;

  // Layout constants
  const leftMargin = 260;   // space for cause text on the left
  const spineStartX = leftMargin;
  const spineEndX = 1040;

  const boxX = 1080;
  const boxW = 260;
  const boxH = 120;

  const colWidth = 260;
  const boneDx = 170;
  const boneDy = 190;

  // Cause rib layout
  const maxCauses = 6; // keep MVP bounded
  const ribLen = 160;  // rib length outward from bone
  const ribEndInset = 12; // arrow ends slightly before bone point
  const fontSize = 12;

  // Fixed slots along bone (stable and prevents clumping near the spine)
  // Values are t in [0..1] along the diagonal bone from spine->endpoint
  const slots = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72];

  const problem = (props.problem || "Define the problem").trim();
  const cats = props.categories ?? [];

  // ---- Geometry helpers ----
  function clampText(s: string, n: number) {
    const t = (s || "").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function normalize(x: number, y: number) {
    const len = Math.sqrt(x * x + y * y) || 1;
    return { x: x / len, y: y / len };
  }

  function wrapTwoLines(text: string, maxCharsPerLine: number) {
    const words = (text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines: string[] = [];
    let current = "";

    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (next.length <= maxCharsPerLine) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = w;
        if (lines.length === 2) break; // already have 2 lines
      }
    }
    if (lines.length < 2 && current) lines.push(current);

    // If still too long, clamp last line
    if (lines.length === 2) lines[1] = clampText(lines[1], maxCharsPerLine);
    if (lines.length === 1) lines[0] = clampText(lines[0], maxCharsPerLine);

    return lines;
  }

  // Determine number of columns on the left side (categories alternate top/bottom per column)
  const cols = Math.ceil(cats.length / 2);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Main spine */}
      <line x1={spineStartX} y1={spineY} x2={spineEndX} y2={spineY} stroke="black" strokeWidth="2" />

      {/* Problem box */}
      <rect x={boxX} y={spineY - boxH / 2} width={boxW} height={boxH} fill="#fff" stroke="black" />
      <text x={boxX + boxW / 2} y={spineY - 18} textAnchor="middle" fontSize="15" fontWeight="600">
        Problem
      </text>
      <text x={boxX + boxW / 2} y={spineY + 12} textAnchor="middle" fontSize="13">
        {clampText(problem || "Define the problem", 40)}
      </text>

      {/* Helper label */}
      <text x={spineStartX - 85} y={spineY - 10} fontSize="10" fill="#444">
        Causes →
      </text>

      {cats.map((cat, index) => {
        const isTop = index % 2 === 0;
        const col = Math.floor(index / 2);

        // Anchor point on spine (spread evenly)
        const ax = spineStartX + 120 + col * colWidth;
        const ay = spineY;

        // Endpoint for category bone
        const bx = ax + boneDx;
        const by = isTop ? spineY - boneDy : spineY + boneDy;

        // Bone direction vector
        const vx = bx - ax;
        const vy = by - ay;
        const v = normalize(vx, vy);

        // Perpendicular normal to bone (two possibilities). We want it pointing "left-ish"
        // so ribs extend to the left side of the canvas.
        const n1 = normalize(-v.y, v.x);
        const n2 = normalize(v.y, -v.x);
        const n = n1.x < 0 ? n1 : n2; // pick the one with negative X

        // Causes: cleaned + capped
        const causeList = (cat.causes ?? [])
          .map((c) => (c || "").trim())
          .filter(Boolean)
          .slice(0, maxCauses);

        // Category label near endpoint
        const labelX = bx + 10;
        const labelY = by;

        // Marker id must be unique
        const markerId = `arrow-${index}`;

        return (
          <g key={`${cat.name}-${index}`}>
            <defs>
              <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="black" />
              </marker>
            </defs>

            {/* Diagonal bone */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="black" strokeWidth="2" />

            {/* Category label */}
            <text x={labelX} y={labelY} fontSize="14" fontWeight="600" dominantBaseline="middle">
              {cat.name}
            </text>

            {/* Cause ribs: perpendicular to bone (prevents overlap near spine) */}
            {causeList.map((cause, i) => {
              const t = slots[i] ?? slots[slots.length - 1];

              // Point on bone at slot t
              const px = lerp(ax, bx, t);
              const py = lerp(ay, by, t);

              // Rib goes outward along normal n
              const startX = px + n.x * ribLen;
              const startY = py + n.y * ribLen;

              const endX = px + n.x * ribEndInset;
              const endY = py + n.y * ribEndInset;

              // Text placed slightly before rib start (further outward), anchored to left
              const textX = startX + n.x * 8;
              const textY = startY + n.y * 8;

              // Wrap to 2 lines
              const lines = wrapTwoLines(cause, 22);

              // Align text so it stays readable regardless of top/bottom
              // If rib normal points left, "end" anchor will keep it inside the canvas.
              const textAnchor = n.x < 0 ? "end" : "start";

              return (
                <g key={i}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="black"
                    strokeWidth="1.5"
                    markerEnd={`url(#${markerId})`}
                  />
                  <text x={textX} y={textY} fontSize={fontSize} textAnchor={textAnchor}>
                    <tspan x={textX} dy="0">
                      {lines[0]}
                    </tspan>
                    {lines[1] ? (
                      <tspan x={textX} dy="14">
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