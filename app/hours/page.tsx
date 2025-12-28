"use client";

import { useEffect, useMemo, useState } from "react";
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
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
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
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Ma–Vr

  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [cells, setCells] = useState<Record<string, EntryCell>>({}); // key = todoId|date

  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [executedByTodo, setExecutedByTodo] = useState<Record<string, number>>({}); // todo_id -> executed_minutes (<= today)

  const todayISO = useMemo(() => iso(new Date()), []);

  function cellKey(todoId: string, dateISO: string) {
    return `${todoId}|${dateISO}`;
  }

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("Geen workspace gevonden.");
      router.push("/projects");
      return;
    }
    setWorkspaceId(ws.workspaceId);

    // 1) load my todos (assigned_to = me)
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,project_id,title,assigned_to,estimated_minutes,projects(name)")
      .eq("assigned_to", user.id)
      .order("project_id", { ascending: true })
      .order("inserted_at", { ascending: false });

    if (tdErr) {
      console.error(tdErr);
      alert(tdErr.message);
      setTodos([]);
      setLoading(false);
      return;
    }

    const todoList = (td as any as TodoRow[]) ?? [];
    setTodos(todoList);

    // 2) load entries for this week for these todos (only for user_id = me)
    const ids = todoList.map((t) => t.id);
    if (ids.length === 0) {
      setCells({});
      setExecutedByTodo({});
      setLoading(false);
      return;
    }

    const from = iso(days[0]);
    const to = iso(days[days.length - 1]);

    const { data: entries, error: eErr } = await supabase
      .from("time_entries")
      .select("id,todo_id,project_id,user_id,entry_date,minutes,note")
      .in("todo_id", ids)
      .eq("user_id", user.id)
      .gte("entry_date", from)
      .lte("entry_date", to);

    if (eErr) {
      console.error(eErr);
      alert(eErr.message);
      setCells({});
    } else {
      const map: Record<string, EntryCell> = {};
      for (const en of (entries as any as EntryCell[]) ?? []) {
        map[cellKey(en.todo_id, en.entry_date)] = en;
      }
      setCells(map);
    }

    // 3) load executed totals per todo (<= today) via view
    const { data: ex, error: exErr } = await supabase
      .from("todo_executed_totals")
      .select("todo_id, executed_minutes")
      .in("todo_id", ids);

    if (!exErr) {
      const m: Record<string, number> = {};
      for (const r of (ex as any[]) ?? []) m[r.todo_id] = r.executed_minutes ?? 0;
      setExecutedByTodo(m);
    } else {
      console.error(exErr);
      setExecutedByTodo({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function setCell(todo: TodoRow, dateISO: string, hoursText: string) {
    if (!workspaceId || !userId) return;

    const key = cellKey(todo.id, dateISO);
    const minutes = hoursInputToMinutes(hoursText);

    // leeg => delete
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

      // update local state
      const copy = { ...cells };
      delete copy[key];
      setCells(copy);
      return;
    }

    // upsert (unique index zorgt dat dit werkt)
    setSavingKey(key);

    const payload = {
      workspace_id: workspaceId,
      project_id: todo.project_id,
      todo_id: todo.id,
      user_id: userId,         // “voor wie” (assignee). MVP: je eigen grid => jijzelf.
      logged_by: userId,       // wie invult (later: owner kan anderen invullen)
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

  if (loading) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  // group by project name
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

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Uren plannen (week)</h1>
          <div className="text-sm text-gray-500">
            Alleen jouw taken (assigned_to = jij). Uren in de toekomst tellen niet mee voor voortgang.
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projecten
          </Button>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={prevWeek}>← Vorige</Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            Vandaag
          </Button>
          <Button variant="outline" onClick={nextWeek}>Volgende →</Button>
        </div>
        <div className="text-sm text-gray-600">
          Week van <span className="font-medium">{iso(days[0])}</span>
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="mt-8 text-gray-600">
          Geen taken aan jou toegewezen.
          <div className="text-sm text-gray-500 mt-1">
            Wijs taken toe via <code>assigned_to</code> om ze hier te plannen.
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse">
            <thead>
              <tr className="text-left">
                <th className="border p-2 w-[320px]">Taak</th>
                {days.map((d) => {
                  const dISO = iso(d);
                  const label = d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" });
                  const isPastOrToday = dISO <= todayISO;
                  return (
                    <th key={dISO} className="border p-2">
                      <div className="flex items-center justify-between">
                        <span>{label}</span>
                        {!isPastOrToday ? (
                          <span className="text-xs text-gray-400">future</span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
                <th className="border p-2 w-[140px]">Voortgang</th>
              </tr>
            </thead>

            <tbody>
              {grouped.map((grp) => (
                <tbody key={grp.projectId}>
                  <tr>
                    <td className="border p-2 font-semibold bg-gray-50" colSpan={days.length + 2}>
                      {grp.projectName}
                    </td>
                  </tr>

                  {grp.items.map((t) => {
                    const prog = todoProgress(t);
                    return (
                      <tr key={t.id}>
                        <td className="border p-2">
                          <div className="font-medium">{t.title}</div>
                          <div className="text-xs text-gray-500">
                            Benodigd: {minutesToHoursInput(t.estimated_minutes) || "—"}u
                          </div>
                        </td>

                        {days.map((d) => {
                          const dISO = iso(d);
                          const key = cellKey(t.id, dISO);
                          const value = minutesToHoursInput(cells[key]?.minutes);

                          return (
                            <td key={dISO} className="border p-2">
                              <input
                                className="w-full border rounded-md px-2 py-1"
                                defaultValue={value}
                                placeholder="0"
                                inputMode="decimal"
                                disabled={savingKey === key}
                                onBlur={(e) => setCell(t, dISO, e.target.value)}
                              />
                            </td>
                          );
                        })}

                        <td className="border p-2">
                          {prog === null ? (
                            <span className="text-sm text-gray-500">—</span>
                          ) : (
                            <div className="text-sm">
                              <span className="font-medium">{prog}%</span>
                              <div className="text-xs text-gray-500">
                                uitgevoerd: {minutesToHoursText(executedByTodo[t.id] ?? 0)}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}

              <tr>
                <td className="border p-2 font-semibold">Totaal</td>
                {days.map((d) => {
                  const dISO = iso(d);
                  return (
                    <td key={dISO} className="border p-2 font-semibold">
                      {minutesToHoursText(dayTotalMinutes(dISO))}
                    </td>
                  );
                })}
                <td className="border p-2" />
              </tr>
            </tbody>
          </table>

          <div className="mt-3 text-xs text-gray-500">
            Tip: wijzig een cel en klik ergens buiten het veld (onBlur) om op te slaan.
          </div>
        </div>
      )}
    </main>
  );
}
