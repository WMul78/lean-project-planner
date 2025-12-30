"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser } from "@/app/lib/appContext";

type TodoRow = {
  id: string;
  project_id: string;
  title: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  is_done: boolean;
  projects: { name: string } | null;
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
  return `${h}h`;
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
  const [userId, setUserId] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon–Fri

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key = todo|date
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Explicit typing prevents index/“untracked” issues
  const [executedByTodo, setExecutedByTodo] = useState<Record<string, number>>({});

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
        router.push("/projects");
        return;
      }
      setWorkspaceId(ws.workspaceId);

      // 1) My tasks (assigned_to = me)
      const { data: td, error: tdErr } = await supabase
        .from("todos")
        .select("id,project_id,title,assigned_to,estimated_minutes,is_done,projects(name)")
        .eq("assigned_to", user.id)
        .eq("is_done", false) // only open tasks
        .order("project_id", { ascending: true })
        .order("inserted_at", { ascending: false });

      if (tdErr) {
        console.error(tdErr);
        alert(tdErr.message);
        setTodos([]);
        setCells({});
        setExecutedByTodo({});
        return;
      }

      const todoList = (td as any as TodoRow[]) ?? [];
      setTodos(todoList);

      const ids = todoList.map((t) => t.id);
      if (ids.length === 0) {
        setCells({});
        setExecutedByTodo({});
        return;
      }

      // 2) Load entries for the visible week
      const from = iso(days[0]);
      const to = iso(days[4]);

      const { data: en, error: enErr } = await supabase
        .from("time_entries")
        .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
        .in("todo_id", ids)
        .eq("user_id", user.id)
        .gte("entry_date", from)
        .lte("entry_date", to);

      if (enErr) {
        console.error(enErr);
        setCells({});
      } else {
        const map: Record<string, EntryCell> = {};
        for (const r of (en as any[]) ?? []) {
          map[cellKey(r.todo_id, r.entry_date)] = r as EntryCell;
        }
        setCells(map);
      }

      // 3) Executed totals per todo (<= today) via view
      const { data: ex, error: exErr } = await supabase
        .from("todo_executed_totals")
        .select("todo_id, executed_minutes")
        .in("todo_id", ids);

      if (exErr) {
        console.error(exErr);
        setExecutedByTodo({});
      } else {
        const m: Record<string, number> = {};
        for (const r of (ex as any[]) ?? []) {
          m[r.todo_id] = r.executed_minutes ?? 0;
        }
        setExecutedByTodo(m);
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

    // Empty => delete if exists
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

    // Upsert (requires unique index on todo_id, entry_date, user_id)
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId, // MVP: this is your own planner (later: assignee planning)
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

  const grouped = useMemo(() => {
    const g = new Map<string, { projectId: string; projectName: string; items: TodoRow[] }>();
    for (const t of todos) {
      const name = t.projects?.name ?? "Project";
      const k = `${t.project_id}|${name}`;
      if (!g.has(k)) g.set(k, { projectId: t.project_id, projectName: name, items: [] });
      g.get(k)!.items.push(t);
    }
    return Array.from(g.values());
  }, [todos]);

  if (loading) {
    return (
      <main className="p-6 max-w-7xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Plan hours (week)</h1>
          <div className="text-sm text-gray-500">
            Only your tasks. Future hours do not count towards progress.
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projects
          </Button>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={prevWeek}>
            ← Previous
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            Today
          </Button>
          <Button variant="outline" onClick={nextWeek}>
            Next →
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          Week starting <span className="font-medium">{iso(days[0])}</span>
        </div>
      </div>

      {/* Mobile day picker */}
      <div className="mt-4 flex items-center justify-between md:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileDayIndex((i) => Math.max(0, i - 1))}
          disabled={mobileDayIndex === 0}
        >
          ←
        </Button>

        <div className="text-sm font-medium">
          {mobileDay
            ? mobileDay.toLocaleDateString(undefined, {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })
            : ""}
        </div>

        <Button
          variant="outline"
          onClick={() => setMobileDayIndex((i) => Math.min(4, i + 1))}
          disabled={mobileDayIndex === 4}
        >
          →
        </Button>
      </div>

      {todos.length === 0 ? (
        <div className="mt-8 text-gray-600">
          No tasks assigned to you.
          <div className="text-sm text-gray-500 mt-1">
            Assign tasks via <code>assigned_to</code> to plan them here.
          </div>
        </div>
      ) : (
        <>
          {/* DESKTOP: week table */}
          <div className="mt-6 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 340 }} />
                  {days.map((d) => (
                    <col key={iso(d)} style={{ width: 96 }} />
                  ))}
                  <col style={{ width: 160 }} />
                </colgroup>

                <thead>
                  <tr className="text-left bg-white">
                    <th className="border p-2 sticky left-0 bg-white z-10">Task</th>

                    {days.map((d) => {
                      const dISO = iso(d);
                      const label = d.toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      });

                      return (
                        <th key={dISO} className="border p-2">
                          {label}
                        </th>
                      );
                    })}

                    <th className="border p-2">Progress</th>
                  </tr>
                </thead>

                <tbody>
                  {grouped.map((grp) => (
                    <React.Fragment key={grp.projectId}>
                      <tr>
                        <td
                          className="border p-2 font-semibold bg-gray-50 sticky left-0 z-10"
                          colSpan={days.length + 2}
                        >
                          {grp.projectName}
                        </td>
                      </tr>

                      {grp.items.map((t) => {
                        const prog = todoProgress(t);
                        const exec = executedByTodo[t.id] ?? 0;

                        return (
                          <tr key={t.id}>
                            <td className="border p-2 sticky left-0 bg-white z-10">
                              <div className="font-medium">{t.title}</div>
                              <div className="text-xs text-gray-500">
                                Planned:{" "}
                                {t.estimated_minutes ? minutesToHoursText(t.estimated_minutes) : "—"}
                              </div>
                            </td>

                            {days.map((d) => {
                              const dISO = iso(d);
                              const key = cellKey(t.id, dISO);
                              const value = cells[key]?.minutes ?? null;
                              const isSaving = savingKey === key;

                              return (
                                <td key={dISO} className="border p-2 align-top">
                                  <input
                                    className="w-full border rounded-md px-2 py-1 text-sm"
                                    defaultValue={minutesToHoursInput(value)}
                                    placeholder="0"
                                    inputMode="decimal"
                                    disabled={isSaving}
                                    onBlur={(e) => setCell(t, dISO, e.target.value)}
                                  />
                                </td>
                              );
                            })}

                            <td className="border p-2 align-top">
                              {prog === null ? (
                                <span className="text-sm text-gray-500">—</span>
                              ) : (
                                <div className="text-sm">
                                  <span className="font-medium">{prog}%</span>
                                  <div className="text-xs text-gray-500">
                                    executed: {minutesToHoursText(exec)}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}

                  <tr>
                    <td className="border p-2 font-semibold">Total</td>
                    <td className="border p-2 font-semibold">
                      {minutesToHoursText(dayTotalMinutes(mobileDayISO))}
                    </td>
                    <td className="border p-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Tip: edit a cell and click outside the input (onBlur) to save.
          </div>
        </>
      )}
    </main>
  );
}
