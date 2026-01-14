"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type ProjectStatus = "proposed" | "active" | "done" | "archived";
type TodoAutoStatus = "proposed" | "active" | "done";

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
};

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number | null;
  auto_status: TodoAutoStatus;

  // attached client-side (since todo_status_auto has no workspace_id)
  projects: { id: string; name: string; status: ProjectStatus } | null;
};

type EntryCell = {
  id: string;
  todo_id: string;
  project_id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  minutes: number;
  note: string | null;
};

function iso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

function minutesToHoursInput(min: number | null | undefined) {
  if (!min) return "";
  const h = Math.round((min / 60) * 10) / 10;
  return String(h);
}

function hoursInputToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export default function HoursPlannerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");

  const [userId, setUserId] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon–Fri

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key=todo|date

  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Executed minutes per todo (from view)
  const [executedByTodo, setExecutedByTodo] = useState<Record<string, number>>({});

  const todayISO = useMemo(() => iso(new Date()), []);
  const [mobileDayIndex, setMobileDayIndex] = useState(0); // 0..4
  const mobileDay = days[mobileDayIndex];
  const mobileDayISO = mobileDay ? iso(mobileDay) : "";

  function cellKey(todoId: string, dateISO: string) {
    return `${todoId}|${dateISO}`;
  }

  async function load() {
    setLoading(true);

    try {
      const user = await requireUser(router);
      if (!user) return;

      setUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        alert("No workspace found.");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setWorkspaceRole(ws.role);

      // ✅ STEP 1: Load visible projects for this workspace
      // Hide: proposed + archived
      // Visible: active + done
      const { data: pr, error: prErr } = await supabase
        .from("projects")
        .select("id,name,status")
        .eq("workspace_id", ws.workspaceId)
        .not("status", "in", '("proposed","archived")');

      if (prErr) {
        console.error("Load projects failed:", prErr);
        setTodos([]);
        setExecutedByTodo({});
      } else {
        const projects = ((pr as any) ?? []) as ProjectRow[];
        const projectIds = projects.map((p) => p.id);

        if (projectIds.length === 0) {
          setTodos([]);
          setExecutedByTodo({});
        } else {
          const projectById: Record<string, ProjectRow> = {};
          for (const p of projects) projectById[p.id] = p;

          // ✅ STEP 2: Load todos via todo_status_auto using project_id IN (...)
          // Hide: todos that are proposed (keep active + done)
          // IMPORTANT: todo_status_auto has NO workspace_id, so we filter by project_id.
          const { data: td, error: tdErr } = await supabase
            .from("todo_status_auto")
            .select("id,project_id,title,assigned_to,estimated_minutes,executed_minutes,auto_status,inserted_at")
            .in("project_id", projectIds)
            .neq("auto_status", "proposed")
            .order("inserted_at", { ascending: false });

          if (tdErr) {
            console.error("Load todos failed:", tdErr);
            setTodos([]);
            setExecutedByTodo({});
          } else {
            const raw = ((td as any) ?? []) as any[];

            // ✅ STEP 3: Attach project info client-side (for grouping + clicking)
            const enriched: TodoRow[] = raw
              .map((t) => ({
                id: String(t.id),
                project_id: String(t.project_id),
                title: String(t.title ?? ""),
                assigned_to: (t.assigned_to as string | null) ?? null,
                estimated_minutes: (t.estimated_minutes as number | null) ?? null,
                executed_minutes: (t.executed_minutes as number | null) ?? null,
                auto_status: (t.auto_status as TodoAutoStatus) ?? "active",
                projects: projectById[String(t.project_id)] ?? null,
              }))
              .filter((t) => !!t.projects); // safety

            // Sort: by project name then by title
            enriched.sort((a, b) => {
              const pa = a.projects?.name ?? "";
              const pb = b.projects?.name ?? "";
              if (pa !== pb) return pa.localeCompare(pb);
              return (a.title ?? "").localeCompare(b.title ?? "");
            });

            setTodos(enriched);

            const execMap: Record<string, number> = {};
            for (const t of enriched) execMap[t.id] = t.executed_minutes ?? 0;
            setExecutedByTodo(execMap);
          }
        }
      }

      // Load time entries for current user + current week (Mon..Fri)
      const fromISO = iso(days[0]);
      const toISO = iso(days[4]);

      const { data: te, error: teErr } = await supabase
        .from("time_entries")
        .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
        .eq("workspace_id", ws.workspaceId)
        .eq("user_id", user.id)
        .gte("entry_date", fromISO)
        .lte("entry_date", toISO);

      if (teErr) {
        console.error("Load time entries failed:", teErr);
        setCells({});
      } else {
        const m: Record<string, EntryCell> = {};
        for (const r of ((te as any) ?? []) as EntryCell[]) {
          m[cellKey(r.todo_id, r.entry_date)] = r;
        }
        setCells(m);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMobileDayIndex(0);
  }, [weekStart]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function setCell(todo: TodoRow, dateISO: string, hoursText: string) {
    if (!workspaceId || !userId) return;

    const key = cellKey(todo.id, dateISO);
    const minutes = hoursInputToMinutes(hoursText);

    // Empty => delete
    if (!minutes) {
      const existing = cells[key];
      if (!existing) return;

      setSavingKey(key);
      const { error } = await supabase.from("time_entries").delete().eq("id", existing.id);
      setSavingKey(null);

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      const copy = { ...cells };
      delete copy[key];
      setCells(copy);
      return;
    }

    // Upsert for current user
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId,
      logged_by: userId,
      entry_date: dateISO,
      minutes,
      note: null,
    };

    const { data, error } = await supabase
      .from("time_entries")
      .upsert(payload, { onConflict: "todo_id,entry_date,user_id" })
      .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
      .single();

    setSavingKey(null);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setCells({ ...cells, [key]: data as any });
  }

  function dayTotalMinutes(dateISO: string) {
    let sum = 0;
    for (const t of todos) {
      const c = cells[cellKey(t.id, dateISO)];
      if (c?.minutes) sum += c.minutes;
    }
    return sum;
  }

  function todoProgress(todo: TodoRow) {
    const planned = todo.estimated_minutes ?? 0;
    if (planned <= 0) return null;
    const exec = executedByTodo[todo.id] ?? 0;
    return Math.min(100, Math.round((exec / planned) * 100));
  }

  function nextWeek() {
    setWeekStart(addDays(weekStart, 7));
  }

  function prevWeek() {
    setWeekStart(addDays(weekStart, -7));
  }

  // Group by project
  const grouped = useMemo(() => {
    const g = new Map<string, { projectId: string; projectName: string; items: TodoRow[] }>();
    for (const t of todos) {
      const pid = t.project_id;
      const pname = t.projects?.name ?? "Project";
      const cur = g.get(pid) ?? { projectId: pid, projectName: pname, items: [] };
      cur.items.push(t);
      g.set(pid, cur);
    }
    return Array.from(g.values());
  }, [todos]);

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Hours</h1>
          <div className="text-sm text-gray-500">
            Week of {iso(weekStart)} • Role: {workspaceRole}
          </div>
          <div className="text-xs text-gray-400">
            Hidden: projects <span className="font-medium">proposed/archived</span> and tasks{" "}
            <span className="font-medium">proposed</span>. Visible: <span className="font-medium">active/done</span>.
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      {/* Week nav */}
      <section className="mt-5 border rounded-lg bg-white p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button variant="outline" onClick={prevWeek}>
              ← Prev
            </Button>
            <Button variant="outline" onClick={nextWeek}>
              Next →
            </Button>
          </div>

        {/* mobile day picker (mobile only) */}
        <div className="grid gap-1 md:hidden">
          <label className="text-sm font-medium">Mobile day</label>
           <select
            className="border rounded-md px-3 py-2"
            value={mobileDayIndex}
            onChange={(e) => setMobileDayIndex(Number(e.target.value))}
          >
            {days.map((d, i) => (
              <option key={i} value={i}>
                {iso(d)}
                {iso(d) === todayISO ? " (today)" : ""}
              </option>
            ))}
          </select>
        </div>
        </div>
      </section>

      {/* Desktop table */}
      <section className="mt-6 hidden md:block">
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 border-b w-[360px]">Project / Task</th>
                {days.map((d) => {
                  const dISO = iso(d);
                  return (
                    <th key={dISO} className="text-left p-3 border-b w-[140px]">
                      <div className="font-medium">
                        {dISO} {dISO === todayISO ? "• Today" : ""}
                      </div>
                      <div className="text-xs text-gray-500">Total: {minutesToHoursText(dayTotalMinutes(dISO))}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={1 + days.length}>
                    No tasks available (filters may hide everything).
                  </td>
                </tr>
              ) : (
                grouped.map((grp) => (
                  <React.Fragment key={grp.projectId}>
                    {/* Project row (clickable) */}
                    <tr className="bg-white">
                      <td className="p-3 border-b font-semibold text-gray-900" colSpan={1 + days.length}>
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => router.push(`/projects/${grp.projectId}`)}
                        >
                          {grp.projectName}
                        </button>
                      </td>
                    </tr>

                    {grp.items.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/60">
                        <td className="p-3 border-b">
                          <div className="text-gray-900">{t.title}</div>
                          <div className="text-xs text-gray-500 flex gap-2 flex-wrap mt-1">
                            {t.estimated_minutes ? <span>Est: {minutesToHoursText(t.estimated_minutes)}</span> : null}
                            {typeof todoProgress(t) === "number" ? <span>Progress: {todoProgress(t)}%</span> : null}
                            <span className="opacity-70">• {t.auto_status}</span>
                          </div>
                        </td>

                        {days.map((d) => {
                          const dISO = iso(d);
                          const key = cellKey(t.id, dISO);
                          const val = minutesToHoursInput(cells[key]?.minutes ?? null);

                          return (
                            <td key={dISO} className="p-2 border-b align-top">
                              <input
                                className={[
                                  "w-full border rounded-md px-2 py-1",
                                  dISO === todayISO ? "border-gray-900" : "",
                                ].join(" ")}
                                placeholder="h"
                                value={val}
                                onChange={(e) => setCell(t, dISO, e.target.value)}
                                disabled={savingKey === key}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile simplified */}
      <section className="mt-6 md:hidden">
        <div className="border rounded-lg bg-white p-4">
          <div className="text-sm text-gray-700">
            Day: <span className="font-medium">{mobileDayISO}</span>{" "}
            {mobileDayISO === todayISO ? <span className="text-gray-900">• Today</span> : null}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total: {minutesToHoursText(dayTotalMinutes(mobileDayISO))}</div>

          <div className="mt-4 grid gap-4">
            {grouped.length === 0 ? (
              <div className="text-sm text-gray-500">No tasks available.</div>
            ) : (
              grouped.map((grp) => (
                <div key={grp.projectId} className="border rounded-lg p-3">
                  <button
                    type="button"
                    className="font-semibold text-gray-900 hover:underline"
                    onClick={() => router.push(`/projects/${grp.projectId}`)}
                  >
                    {grp.projectName}
                  </button>

                  <div className="mt-2 grid gap-2">
                    {grp.items.map((t) => {
                      const key = cellKey(t.id, mobileDayISO);
                      const val = minutesToHoursInput(cells[key]?.minutes ?? null);

                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-900 truncate">{t.title}</div>
                            <div className="text-xs text-gray-500">
                              {t.estimated_minutes ? `Est: ${minutesToHoursText(t.estimated_minutes)}` : "No estimate"} •{" "}
                              {t.auto_status}
                            </div>
                          </div>

                          <input
                            className="w-[86px] border rounded-md px-2 py-1 text-sm"
                            placeholder="h"
                            value={val}
                            onChange={(e) => setCell(t, mobileDayISO, e.target.value)}
                            disabled={savingKey === key}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="mt-3 text-xs text-gray-500">
        (c) Improvica 2026
      </div>
    </main>
  );
}
