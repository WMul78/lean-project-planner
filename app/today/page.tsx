"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser } from "@/app/lib/appContext";

type TimeEntry = {
  id: string;
  project_id: string;
  entry_date: string;
  minutes: number;
  note: string | null;
  inserted_at: string;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minutesToHoursText(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h}u`;
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [sumMinutes, setSumMinutes] = useState(0);

  const [entryHours, setEntryHours] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const day = useMemo(() => todayISO(), []);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("Geen workspace gevonden.");
      router.push("/projects");
      return;
    }

    // projects dropdown
    const { data: ps } = await supabase
      .from("projects")
      .select("id,name")
      .eq("workspace_id", ws.workspaceId)
      .order("inserted_at", { ascending: false });

    setProjects((ps as any[])?.map((p) => ({ id: p.id, name: p.name })) ?? []);
    if (!projectId && (ps as any[])?.[0]?.id) setProjectId((ps as any[])[0].id);

    // today's entries
    const { data: e, error } = await supabase
      .from("time_entries")
      .select("id,project_id,entry_date,minutes,note,inserted_at")
      .eq("workspace_id", ws.workspaceId)
      .eq("entry_date", day)
      .order("inserted_at", { ascending: false });

    if (error) {
      console.error(error);
      setEntries([]);
      setSumMinutes(0);
    } else {
      const list = (e as TimeEntry[]) ?? [];
      setEntries(list);
      setSumMinutes(list.reduce((acc, x) => acc + (x.minutes ?? 0), 0));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEntry() {
    const minutes = hoursTextToMinutes(entryHours);
    if (!minutes) return alert("Vul geldige uren in (bijv. 1.0).");
    if (!projectId) return alert("Kies een project.");

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) return alert("Geen workspace.");

    const user = await supabase.auth.getUser();
    const uid = user.data.user?.id;
    if (!uid) return alert("Niet ingelogd.");

    setSaving(true);

    const { error } = await supabase.from("time_entries").insert({
      workspace_id: ws.workspaceId,
      project_id: projectId,
      todo_id: null,
      user_id: uid,
      entry_date: day,
      minutes,
      note: entryNote.trim() || null,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setEntryHours("");
    setEntryNote("");
    load();
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vandaag</h1>
          <div className="text-sm text-gray-500">{day}</div>
          <div className="mt-2 text-sm">
            Totaal vandaag: <span className="font-medium">{minutesToHoursText(sumMinutes)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Projecten
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="mt-6 text-gray-500">Laden…</div>
      ) : (
        <>
          <section className="mt-6 border rounded-lg p-4">
            <h2 className="font-medium">Snel loggen</h2>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Project</label>
                <select
                  className="border rounded-md px-3 py-2"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={saving}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Uren</label>
                <input
                  className="border rounded-md px-3 py-2"
                  value={entryHours}
                  onChange={(e) => setEntryHours(e.target.value)}
                  placeholder="bijv. 0.5"
                  inputMode="decimal"
                  disabled={saving}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium">Actie</label>
                <Button onClick={addEntry} disabled={saving}>
                  {saving ? "Opslaan…" : "Log tijd"}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-1">
              <label className="text-sm font-medium">Notitie</label>
              <input
                className="border rounded-md px-3 py-2"
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                placeholder="optioneel"
                disabled={saving}
              />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-medium">Registraties vandaag</h2>
            {entries.length === 0 ? (
              <div className="mt-2 text-sm text-gray-600">Nog niets gelogd vandaag.</div>
            ) : (
              <ul className="mt-3 grid gap-2">
                {entries.map((e) => (
                  <li key={e.id} className="border rounded-md p-3">
                    <div className="text-sm">
                      <span className="font-medium">{minutesToHoursText(e.minutes)}</span>
                      {e.note ? <span className="text-gray-600"> • {e.note}</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(e.inserted_at).toLocaleString()} • Project: {e.project_id}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
