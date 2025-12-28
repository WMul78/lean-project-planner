"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  // nieuwe velden
  deadline: string | null; // YYYY-MM-DD
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
  estimated_minutes: number | null;
};

type TimeEntry = {
  id: string;
  todo_id: string | null;
  project_id: string;
  user_id: string;
  logged_by: string | null;
  entry_date: string;
  minutes: number;
  note: string | null;
  inserted_at: string;
};

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h}u`;
}

function pct(executed: number, planned: number) {
  if (!planned || planned <= 0) return null;
  return Math.min(100, Math.round((executed / planned) * 100));
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
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // ✅ Stap 6: planned/executed totals (project-level)
  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // optioneel: laatste entries tonen (handig voor debug/vertrouwen)
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const canEditProject = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: alleen eigen proposal (MVP)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  const canEditTodos = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: geen todo edits
    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  async function loadProjectAndTodos() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    // project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("id,name,description,status,owner_id,created_by,deadline,priority,project_type,phase,location_link")
      .eq("id", projectId)
      .single();

    if (projErr) {
      alert(projErr.message);
      router.push("/projects");
      return;
    }

    setProject(proj as any);

    // membership role (samenwerking)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    setProjectMemberRole((pm as any)?.role ?? null);

    // todos + estimated_minutes
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at,assigned_to,estimated_minutes")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (tdErr) {
      alert(tdErr.message);
      return;
    }
    setTodos((td as any) ?? []);
  }

  async function loadTotals(pid: string) {
    // planned = sum todos.estimated_minutes
    const { data: plan, error: planErr } = await supabase
      .from("project_planned_totals")
      .select("planned_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (planErr) console.error("Load planned totals error:", planErr);
    setPlannedMinutes((plan as any)?.planned_minutes ?? 0);

    // executed = sum time_entries.minutes where entry_date <= today
    const { data: exec, error: execErr } = await supabase
      .from("project_executed_totals")
      .select("executed_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (execErr) console.error("Load executed totals error:", execErr);
    setExecutedMinutes((exec as any)?.executed_minutes ?? 0);
  }

  async function loadRecentEntries(pid: string) {
    setEntriesLoading(true);

    const { data, error } = await supabase
      .from("time_entries")
      .select("id,todo_id,project_id,user_id,logged_by,entry_date,minutes,note,inserted_at")
      .eq("project_id", pid)
      .order("inserted_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Load entries error:", error);
      setEntries([]);
    } else {
      setEntries((data as TimeEntry[]) ?? []);
    }

    setEntriesLoading(false);
  }

  useEffect(() => {
    loadProjectAndTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zodra project is geladen: totals (stap 6)
  useEffect(() => {
    if (!project?.id) return;
    loadTotals(project.id);
    loadRecentEntries(project.id); // optioneel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function refreshAll() {
    await loadProjectAndTodos();
    if (project?.id) {
      await loadTotals(project.id);
      await loadRecentEntries(project.id);
    }
  }

  // CRUD todos
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;

    const clean = newTodoTitle.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
      estimated_minutes: null, // kun je later in UI laten invullen
    });

    if (error) return alert("Geen rechten of fout: " + error.message);

    setNewTodoTitle("");
    await refreshAll();
  }

  async function toggleDone(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ is_done: !todo.is_done }).eq("id", todo.id);
    if (error) return alert("Geen rechten of fout: " + error.message);

    await refreshAll();
  }

  async function removeTodo(todo: Todo) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) return alert("Geen rechten of fout: " + error.message);

    await refreshAll();
  }

  const progress = useMemo(() => pct(executedMinutes, plannedMinutes), [executedMinutes, plannedMinutes]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/hours")}>
            Uren plannen →
          </Button>
          <Button variant="outline" onClick={refreshAll}>
            Verversen
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{project?.name ?? "Project"}</h1>
            {project?.description ? <p className="text-gray-600 mt-1">{project.description}</p> : null}

            {project ? (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm px-2 py-0.5 rounded-full bg-gray-100">{project.status}</span>

                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  prio: {project.priority ?? "medium"}
                </span>

                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  type: {project.project_type ?? "standard"}
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
                <a className="text-blue-600 underline break-all" href={project.location_link} target="_blank" rel="noreferrer">
                  {project.location_link}
                </a>
              </div>
            ) : null}
          </div>

          {canEditProject ? (
            <div className="shrink-0">
              <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)}>
                Project bewerken
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ✅ Stap 6: Project voortgang = executed/planned (tasks) */}
      <section className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold">Voortgang</h2>

        {plannedMinutes > 0 ? (
          <div className="mt-3">
            <ProgressBar
              value={progress ?? 0}
              label={`${minutesToHoursText(executedMinutes)} / ${minutesToHoursText(plannedMinutes)} (${progress ?? 0}%)`}
            />
            <div className="mt-2 text-xs text-gray-500">
              *Uitgevoerd* telt alleen uren met datum t/m vandaag. Uren in de toekomst zijn alleen planning.
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Nog geen taak-ramingen ingevuld (planned = 0). Vul per taak de benodigde tijd in.
          </div>
        )}
      </section>

      {/* TODOS */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Taken</h2>

          <div className="text-sm text-gray-500">
            Workspace rol: {workspaceRole} {projectMemberRole ? `• Project rol: ${projectMemberRole}` : ""}
          </div>
        </div>

        {canEditTodos ? (
          <form onSubmit={addTodo} className="flex gap-2 mt-3">
            <input
              className="flex-1 border rounded-md px-3 py-2"
              placeholder="Nieuwe taak..."
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
            />
            <Button type="submit">Toevoegen</Button>
          </form>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Je kunt taken niet aanpassen in dit project (geen edit-rechten).
          </div>
        )}

        <ul className="mt-4 grid gap-2">
          {todos.map((t) => (
            <li key={t.id} className="border rounded-lg p-3 flex justify-between items-center gap-3">
              <label className="flex gap-3 items-center flex-1 min-w-0">
                <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} disabled={!canEditTodos} />
                <div className="min-w-0">
                  <div className={t.is_done ? "line-through text-gray-500" : ""}>{t.title}</div>
                  <div className="text-xs text-gray-500">
                    Benodigd: {t.estimated_minutes ? minutesToHoursText(t.estimated_minutes) : "—"} • Assignee:{" "}
                    {t.assigned_to ? "yes" : "—"}
                  </div>
                </div>
              </label>

              {canEditTodos ? (
                <Button variant="danger" onClick={() => removeTodo(t)}>
                  Verwijder
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Optioneel: laatste time entries (handig bij testen) */}
      <section className="mt-8 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Laatste planning/registraties</h2>
          <Button variant="outline" onClick={() => project?.id && loadRecentEntries(project.id)} disabled={entriesLoading}>
            {entriesLoading ? "Laden…" : "Verversen"}
          </Button>
        </div>

        {entriesLoading ? (
          <div className="mt-3 text-sm text-gray-500">Laden…</div>
        ) : entries.length === 0 ? (
          <div className="mt-3 text-sm text-gray-600">Nog geen entries.</div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {entries.map((e) => (
              <li key={e.id} className="border rounded-md p-3">
                <div className="text-sm">
                  <span className="font-medium">{e.entry_date}</span> • {minutesToHoursText(e.minutes)}
                  {e.todo_id ? <span className="text-gray-600"> • taak: {e.todo_id}</span> : null}
                </div>
                {e.note ? <div className="text-sm text-gray-600 mt-1">{e.note}</div> : null}
                <div className="text-xs text-gray-400 mt-1">
                  user_id: {e.user_id} • logged_by: {e.logged_by ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
