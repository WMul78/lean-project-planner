"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "proposed" | "active" | "done" | "archived";
  owner_id: string | null;
  created_by: string;

  // nieuwe velden
  deadline: string | null; // YYYY-MM-DD
  estimated_minutes: number | null;
  priority: Priority | null;
  project_type: ProjectType | null;
  phase: string | null;
  location_link: string | null;
};

type Todo = {
  id: string;
  title: string;
  is_done: boolean;
  inserted_at: string;
  assigned_to: string | null;
};

type TimeEntry = {
  id: string;
  project_id: string;
  todo_id: string | null;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  minutes: number;
  note: string | null;
  inserted_at: string;
};

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h}u`;
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 60);
}

function calcPct(spent: number, planned: number | null) {
  if (!planned || planned <= 0) return null;
  return Math.min(100, Math.round((spent / planned) * 100));
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");

  // time tracking
  const [spentMinutes, setSpentMinutes] = useState<number>(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [timeLoading, setTimeLoading] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);

  const [entryDate, setEntryDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [entryHours, setEntryHours] = useState<string>("");
  const [entryNote, setEntryNote] = useState<string>("");

  // ✅ Rechten voor PROJECT bewerken (incl. stakeholder proposal)
  const canEditProject = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: alleen eigen proposal bewerken (MVP)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  // ✅ Rechten voor TODOS (zoals je huidige code: stakeholder nooit)
  const canEditTodos = useMemo(() => {
    if (!userId || !project) return false;
    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: nooit todos editten
    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  async function loadAll() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select(
        "id,name,description,status,owner_id,created_by,deadline,estimated_minutes,priority,project_type,phase,location_link"
      )
      .eq("id", projectId)
      .single();

    if (projErr) return alert(projErr.message);
    setProject(proj as any);

    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    setProjectMemberRole((pm as any)?.role ?? null);

    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at,assigned_to")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (tdErr) return alert(tdErr.message);
    setTodos((td as any) ?? []);

    // time data (best effort)
    await loadTimeData(projectId);
  }

  async function loadTimeData(pid: string) {
    setTimeLoading(true);

    // totals uit view
    const { data: totals, error: totalsErr } = await supabase
      .from("project_time_totals")
      .select("project_id, spent_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (totalsErr) {
      console.error("Load totals error:", totalsErr);
      // niet hard falen
    }
    setSpentMinutes((totals as any)?.spent_minutes ?? 0);

    // laatste 10 entries
    const { data: e, error: eErr } = await supabase
      .from("time_entries")
      .select("id, project_id, todo_id, user_id, entry_date, minutes, note, inserted_at")
      .eq("project_id", pid)
      .order("inserted_at", { ascending: false })
      .limit(10);

    if (eErr) {
      console.error("Load entries error:", eErr);
      setEntries([]);
    } else {
      setEntries((e as TimeEntry[]) ?? []);
    }

    setTimeLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;

    const clean = title.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
    });

    if (error) return alert("Geen rechten of fout: " + error.message);

    setTitle("");
    loadAll();
  }

  async function toggleDone(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase
      .from("todos")
      .update({ is_done: !todo.is_done })
      .eq("id", todo.id);

    if (error) alert("Geen rechten of fout: " + error.message);
    loadAll();
  }

  async function removeTodo(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) alert("Geen rechten of fout: " + error.message);
    loadAll();
  }

  async function addTimeEntry() {
    if (!project) return;
    if (timeSaving) return;

    const minutes = hoursTextToMinutes(entryHours);
    if (!minutes) return alert("Vul geldige uren in (bijv. 1.5).");

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) return alert("Geen workspace gevonden.");

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return alert("Niet ingelogd.");

    setTimeSaving(true);

    const { error } = await supabase.from("time_entries").insert({
      workspace_id: ws.workspaceId,
      project_id: project.id,
      todo_id: null, // MVP: later kun je dit koppelen aan een todo
      user_id: uid,
      entry_date: entryDate,
      minutes,
      note: entryNote.trim() || null,
    });

    setTimeSaving(false);

    if (error) {
      console.error("Insert time entry error:", error);
      alert(error.message);
      return;
    }

    setEntryHours("");
    setEntryNote("");
    await loadTimeData(project.id);
  }

  async function deleteEntry(entryId: string) {
    const ok = confirm("Tijdregistratie verwijderen?");
    if (!ok) return;

    const { error } = await supabase.from("time_entries").delete().eq("id", entryId);

    if (error) {
      console.error("Delete time entry error:", error);
      alert(error.message);
      return;
    }

    if (project?.id) await loadTimeData(project.id);
  }

  const projectTypeLabel = project?.project_type ?? "standard";
  const priorityLabel = project?.priority ?? "medium";

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>

        <div className="text-sm text-gray-500">
          Workspace rol: {workspaceRole} {projectMemberRole ? `• Project rol: ${projectMemberRole}` : ""}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{project?.name ?? "Project"}</h1>
          {project?.description ? <p className="text-gray-600 mt-1">{project.description}</p> : null}

          {project ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm px-2 py-0.5 rounded-full bg-gray-100">{project.status}</span>

              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                prio: {priorityLabel}
              </span>

              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                type: {projectTypeLabel}
              </span>

              {project.deadline ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  deadline: {project.deadline}
                </span>
              ) : null}

              {project.phase ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  fase: {project.phase}
                </span>
              ) : null}

              {!canEditProject ? <span className="text-sm text-gray-500">Alleen-lezen</span> : null}
            </div>
          ) : null}

          {project?.location_link ? (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Locatie:</span>{" "}
              <a
                className="text-blue-600 underline break-all"
                href={project.location_link}
                target="_blank"
                rel="noreferrer"
              >
                {project.location_link}
              </a>
            </div>
          ) : null}

          {project ? (
            <div className="mt-2 text-sm text-gray-600">
              Planning: <span className="font-medium">{minutesToHoursText(project.estimated_minutes)}</span>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          {canEditProject ? (
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              Project bewerken
            </Button>
          ) : null}

          <Button variant="outline" onClick={() => router.push(`/today`)}>
            Vandaag →
          </Button>
        </div>
      </div>

      {/* TODOS */}
      {canEditTodos ? (
        <form onSubmit={addTodo} className="flex gap-2 mt-6">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="Nieuwe taak..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit">Toevoegen</Button>
        </form>
      ) : (
        <div className="mt-6 text-sm text-gray-600">
          Je kunt taken niet aanpassen in dit project (geen edit-rechten).
        </div>
      )}

      <ul className="mt-4 grid gap-2">
        {todos.map((t) => (
          <li key={t.id} className="border rounded-lg p-3 flex justify-between items-center gap-3">
            <label className="flex gap-3 items-center flex-1">
              <input
                type="checkbox"
                checked={t.is_done}
                onChange={() => toggleDone(t)}
                disabled={!canEditTodos}
              />
              <span className={t.is_done ? "line-through text-gray-500" : ""}>{t.title}</span>
            </label>
            {canEditTodos ? (
              <Button variant="danger" onClick={() => removeTodo(t)}>
                Verwijder
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {/* TIME + PROGRESS */}
      <section className="mt-8 border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Voortgang & tijd</h2>
          <Button
            variant="outline"
            onClick={() => project?.id && loadTimeData(project.id)}
            disabled={timeLoading}
          >
            {timeLoading ? "Verversen…" : "Verversen"}
          </Button>
        </div>

        {project?.estimated_minutes ? (
          <div className="mt-3">
            {(() => {
              const planned = project.estimated_minutes ?? 0;
              const pct = calcPct(spentMinutes, planned) ?? 0;

              return (
                <>
                  <ProgressBar
                    value={pct}
                    label={`${minutesToHoursText(spentMinutes)} / ${minutesToHoursText(planned)} (${pct}%)`}
                  />
                  <div className="text-xs text-gray-500 mt-2">
                    Spent = totaal gelogde tijd. Planned = estimated_minutes van het project.
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Nog geen planning (estimated time) ingevuld voor dit project.
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Datum</label>
              <input
                type="date"
                className="border rounded-md px-3 py-2"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                disabled={timeSaving}
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Uren</label>
              <input
                className="border rounded-md px-3 py-2"
                value={entryHours}
                onChange={(e) => setEntryHours(e.target.value)}
                placeholder="bijv. 1.5"
                inputMode="decimal"
                disabled={timeSaving}
              />
              <div className="text-xs text-gray-500">Wordt opgeslagen als minuten.</div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Actie</label>
              <Button onClick={addTimeEntry} disabled={timeSaving}>
                {timeSaving ? "Opslaan…" : "Log tijd"}
              </Button>
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Notitie (optioneel)</label>
            <input
              className="border rounded-md px-3 py-2"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="Bijv. analyse gedaan / meeting / etc."
              disabled={timeSaving}
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-medium">Laatste registraties</h3>

          {timeLoading ? (
            <div className="mt-3 text-sm text-gray-500">Laden…</div>
          ) : entries.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">Nog geen registraties.</div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {entries.map((en) => (
                <li key={en.id} className="border rounded-md p-3 flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{en.entry_date}</span>{" "}
                      <span className="text-gray-600">• {minutesToHoursText(en.minutes)}</span>
                    </div>
                    {en.note ? (
                      <div className="text-sm text-gray-600 mt-1 break-words">{en.note}</div>
                    ) : null}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(en.inserted_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {/* RLS vangt af dat je alleen eigen entries mag deleten */}
                    <Button variant="danger" onClick={() => deleteEntry(en.id)}>
                      Verwijder
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
