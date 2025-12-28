"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, badgeClassForStatus, badgeClassForPriority, metaBadgeClass } from "@/app/lib/badges";

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

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
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
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

function calcPct(executed: number, planned: number) {
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

  // ✅ Stap 6 totals
  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // ✅ Workspace members voor assignee dropdown
  const [members, setMembers] = useState<{ id: string; full_name: string; email?: string | null }[]>([]);

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

  const progressPct = useMemo(
    () => calcPct(executedMinutes, plannedMinutes),
    [executedMinutes, plannedMinutes]
  );

  const memberNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of members) {
    m[x.id] = x.full_name || x.email || x.id.slice(0, 8);
    }
    return m;
  } , [members]);

  async function loadProject() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

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

    // membership role (voor samenwerking)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    setProjectMemberRole((pm as any)?.role ?? null);
  }

  async function loadTodos() {
    const { data: td, error: tdErr } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at,assigned_to,estimated_minutes")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (tdErr) {
      alert(tdErr.message);
      setTodos([]);
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

  async function loadWorkspaceMembers() {
  const ws = await getActiveWorkspace();
  if (!ws?.workspaceId) return;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, profiles:profiles(full_name,email)")
    .eq("workspace_id", ws.workspaceId);

  if (error) {
    console.error("Load members error:", error);
    setMembers([]);
    return;
  }

  setMembers(
    ((data as any[]) ?? []).map((r) => ({
      id: r.user_id,
      full_name: r.profiles?.full_name || r.user_id.slice(0, 8),
      email: r.profiles?.email ?? null,
    }))
  );
}


  async function refreshAll() {
    await loadProject();
    await loadTodos();
    await loadWorkspaceMembers();
    if (projectId) await loadTotals(projectId);
  }

  useEffect(() => {
    // init
    (async () => {
      await loadProject();
      await loadTodos();
      await loadWorkspaceMembers();
      await loadTotals(projectId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Todos CRUD ----
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;

    const clean = newTodoTitle.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
      estimated_minutes: null,
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

  // ---- Todo fields updates (estimate + assignee) ----
  async function updateTodoEstimate(todoId: string, hoursText: string) {
    if (!canEditTodos) return;

    const minutes = hoursInputToMinutes(hoursText);
    const next = minutes === null ? null : minutes;

    const { error } = await supabase
      .from("todos")
      .update({ estimated_minutes: next })
      .eq("id", todoId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await refreshAll(); // planned totals updaten
  }

  async function updateTodoAssignee(todoId: string, nextUserId: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase
      .from("todos")
      .update({ assigned_to: nextUserId })
      .eq("id", todoId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await refreshAll();
  }

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

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{project?.name ?? "Project"}</h1>
          {project?.description ? <p className="text-gray-600 mt-1">{project.description}</p> : null}

          {project ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`${badgeBase} ${badgeClassForStatus(project.status)}`}>
                {project.status}
              </span>

              <span className={`${badgeBase} ${badgeClassForPriority(project.priority)}`}>
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

      {/* ✅ Voortgang (stap 6) */}
      <section className="mt-6 border rounded-lg p-4">
        <h2 className="text-lg font-semibold">Voortgang</h2>

        {plannedMinutes > 0 ? (
          <div className="mt-3">
            <ProgressBar
              value={progressPct ?? 0}
              label={`${minutesToHoursText(executedMinutes)} / ${minutesToHoursText(plannedMinutes)} (${progressPct ?? 0}%)`}
            />
            <div className="mt-2 text-xs text-gray-500">
              Uitgevoerd telt alleen uren met datum t/m vandaag. Uren in de toekomst zijn alleen planning.
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            Nog geen taak-ramingen ingevuld (planned = 0). Vul per taak de benodigde tijd in.
          </div>
        )}
      </section>

      {/* Taken */}
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
            <li key={t.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start gap-3">
                <label className="flex gap-3 items-center flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={t.is_done}
                    onChange={() => toggleDone(t)}
                    disabled={!canEditTodos}
                  />
                  <div className="min-w-0">
                    <div className={`font-medium ${t.is_done ? "line-through text-gray-500" : ""}`}>
                         {t.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      Benodigd: {t.estimated_minutes ? minutesToHoursText(t.estimated_minutes) : "—"} •{" "}
                      Toegewezen:{" "}
                        {t.assigned_to ? (memberNameById[t.assigned_to] ?? t.assigned_to.slice(0, 8)) : "—"}
                    </div>
                  </div>
                </label>

                {canEditTodos ? (
                  <Button variant="danger" onClick={() => removeTodo(t)}>
                    Verwijder
                  </Button>
                ) : null}
              </div>

              {/* ✅ Edit velden: estimate + assignee */}
              <div className="mt-2 flex flex-wrap items-end gap-3">
  {/* Benodigd uren: compact */}
  <div className="flex flex-col">
    <label className="text-[11px] text-gray-500 leading-none">Benodigd (u)</label>
    <input
      className="mt-1 w-[110px] border rounded-md px-2 py-1 text-sm"
      defaultValue={minutesToHoursInput(t.estimated_minutes)}
      placeholder="bijv. 2"
      inputMode="decimal"
      disabled={!canEditTodos}
      onBlur={(e) => updateTodoEstimate(t.id, e.target.value)}
    />
  </div>

  {/* Assignee: compact */}
  <div className="flex flex-col min-w-[160px]">
    <label className="text-[11px] text-gray-500 leading-none">Toegewezen</label>
    <select
      className="mt-1 border rounded-md px-2 py-1 text-sm"
      value={t.assigned_to ?? ""}
      disabled={!canEditTodos}
      onChange={(e) => updateTodoAssignee(t.id, e.target.value || null)}
    >
      <option value="">— niemand —</option>
      {userId ? <option value={userId}>Ik</option> : null}
      {members
        .filter((m) => m.id !== userId)
        .map((m) => (
          <option key={m.id} value={m.id}>
          {m.full_name || m.email || m.id.slice(0, 8)}
          </option>

        ))}
    </select>
  </div>

  {/* optioneel: klein hintje rechts */}
  <div className="text-[11px] text-gray-400 leading-snug pb-1">
    (later: naam/email)
  </div>
</div>

              
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
