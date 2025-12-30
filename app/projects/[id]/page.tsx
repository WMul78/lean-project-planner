"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, badgeClassForStatus, badgeClassForPriority, metaBadgeClass } from "@/app/lib/badges";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

const PHASES: Record<Exclude<ProjectType, "standard">, { value: string; label: string }[]> = {
  pdca: [
    { value: "plan", label: "Plan" },
    { value: "do", label: "Do" },
    { value: "check", label: "Check" },
    { value: "act", label: "Act" },
  ],
  dmaic: [
    { value: "define", label: "Define" },
    { value: "measure", label: "Measure" },
    { value: "analyze", label: "Analyze" },
    { value: "improve", label: "Improve" },
    { value: "control", label: "Control" },
  ],
};

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

type TodoAuto = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number; // from view todo_executed_totals / todo_status_auto
  auto_status: "proposed" | "active" | "done"; // from view
  // NEW (requires view/table update)
  phase: string | null;
  sort_order: number | null;
};

type Member = { id: string; full_name: string; email: string | null };

function minutesToHoursText(min: number | null | undefined) {
  const m = min ?? 0;
  const h = Math.round((m / 60) * 10) / 10;
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
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

function calcPct(executed: number, planned: number) {
  if (!planned || planned <= 0) return null;
  return Math.min(100, Math.round((executed / planned) * 100));
}

function clampPhase(projectType: ProjectType | null | undefined, phase: string | null | undefined) {
  if (!projectType || projectType === "standard") return null;
  if (!phase) return null;
  const allowed = new Set(PHASES[projectType].map((p) => p.value));
  return allowed.has(phase) ? phase : null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<TodoAuto[]>([]);
  const todosRef = useRef<TodoAuto[]>([]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const [members, setMembers] = useState<Member[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // UI prefs
  const [hideDoneTasks, setHideDoneTasks] = useState<boolean>(true);

  // drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const canEditProject = useMemo(() => workspaceRole === "owner" || workspaceRole === "admin", [workspaceRole]);

  // Members can edit tasks if they are project member (or owner/admin via workspace)
  const canEditTodos = useMemo(() => {
    if (workspaceRole === "owner" || workspaceRole === "admin") return true;
    return projectMemberRole === "member" || projectMemberRole === "owner" || projectMemberRole === "admin";
  }, [workspaceRole, projectMemberRole]);

  const isStakeholder = useMemo(() => workspaceRole === "stakeholder", [workspaceRole]);

  const filteredTodos = useMemo(() => {
    if (!hideDoneTasks) return todos;
    return todos.filter((t) => t.auto_status !== "done");
  }, [todos, hideDoneTasks]);

  const sortedTodos = useMemo(() => {
    // stable sort: sort_order first, then inserted_at
    const arr = [...filteredTodos];
    arr.sort((a, b) => {
      const ao = a.sort_order ?? 1_000_000;
      const bo = b.sort_order ?? 1_000_000;
      if (ao !== bo) return ao - bo;
      return a.inserted_at < b.inserted_at ? -1 : 1;
    });
    return arr;
  }, [filteredTodos]);

  async function loadProject() {
    const user = await requireUser(router);
    if (!user) return;
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (!ws?.workspaceId) {
      alert("No active workspace found.");
      router.push("/projects");
      return;
    }
    setWorkspaceRole(ws.role);

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

    setProject(proj as Project);

    // Project membership role (for members collaboration)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    setProjectMemberRole((pm as any)?.role ?? null);
  }

  async function loadTodos() {
    // Prefer the view that calculates auto status based on hours (as you already do in Kanban) :contentReference[oaicite:5]{index=5}
    const { data, error } = await supabase
      .from("todo_status_auto")
      // IMPORTANT: requires view to include phase + sort_order, otherwise remove these fields from select/type
      .select("id,project_id,title,inserted_at,assigned_to,estimated_minutes,executed_minutes,auto_status,phase,sort_order")
      .eq("project_id", projectId);

    if (error) {
      console.error("Load todos failed:", error);
      setTodos([]);
      return;
    }

    setTodos(((data as any) ?? []) as TodoAuto[]);
  }

  async function loadTotals(pid: string) {
    const { data: plan, error: planErr } = await supabase
      .from("project_planned_totals")
      .select("planned_minutes")
      .eq("project_id", pid)
      .maybeSingle();

    if (planErr) console.error("Load planned totals error:", planErr);
    setPlannedMinutes((plan as any)?.planned_minutes ?? 0);

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
    if (!project) return;

    const clean = newTodoTitle.trim();
    if (!clean) return;

    // compute next sort_order client-side (safe enough for MVP)
    const current = todosRef.current.filter((t) => t.project_id === projectId);
    const maxSort = current.reduce((mx, t) => Math.max(mx, t.sort_order ?? 0), 0);

    const defaultPhase = project.project_type && project.project_type !== "standard" ? clampPhase(project.project_type, project.phase) : null;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
      assigned_to: null,
      estimated_minutes: null,
      sort_order: maxSort + 1,
      phase: defaultPhase,
    });

    if (error) return alert("No permission or error: " + error.message);

    setNewTodoTitle("");
    await refreshAll();
  }

  async function removeTodo(todoId: string) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").delete().eq("id", todoId);
    if (error) return alert("No permission or error: " + error.message);

    await refreshAll();
  }

  // ---- Todo field updates (estimate + assignee + phase) ----
  async function updateTodoEstimate(todoId: string, hoursText: string) {
    if (!canEditTodos) return;

    const minutes = hoursInputToMinutes(hoursText);
    const next = minutes === null ? null : minutes;

    const { error } = await supabase.from("todos").update({ estimated_minutes: next }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  async function updateTodoAssignee(todoId: string, nextUserId: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ assigned_to: nextUserId }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  async function updateTodoPhase(todoId: string, nextPhase: string | null) {
    if (!canEditTodos) return;

    const { error } = await supabase.from("todos").update({ phase: nextPhase }).eq("id", todoId);
    if (error) return alert(error.message);

    await refreshAll();
  }

  // ---- Drag & drop reorder (persist sort_order) ----
  function onDragStart(todoId: string) {
    if (!canEditTodos) return;
    setDraggingId(todoId);
  }

  function onDragOver(todoId: string) {
    if (!canEditTodos) return;
    if (!draggingId || draggingId === todoId) return;
    setDragOverId(todoId);
  }

  async function onDrop(todoId: string) {
    if (!canEditTodos) return;
    const fromId = draggingId;
    const toId = todoId;
    setDragOverId(null);
    setDraggingId(null);

    if (!fromId || fromId === toId) return;

    const cur = sortedTodos; // already filtered + sorted list
    const fromIdx = cur.findIndex((t) => t.id === fromId);
    const toIdx = cur.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...cur];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Optimistic UI: update local sort_order
    const optimistic = next.map((t, idx) => ({ ...t, sort_order: idx + 1 }));
    setTodos((prev) => {
      // merge optimistic back into full list (including done tasks if hidden)
      const map = new Map(optimistic.map((t) => [t.id, t]));
      return prev.map((t) => map.get(t.id) ?? t);
    });

    // Persist: set sort_order for all items in the reordered list
    const payload = optimistic.map((t) => ({ id: t.id, sort_order: t.sort_order }));
    const { error } = await supabase.from("todos").upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(error);
      alert(error.message);
      await refreshAll(); // revert to server truth
    }
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  const planned = plannedMinutes ?? 0;
  const executed = executedMinutes ?? 0;
  const percent = calcPct(executed, planned);

  const statusClass = `${badgeBase} ${badgeClassForStatus(project.status)}`;
  const prioClass = `${badgeBase} ${badgeClassForPriority(project.priority)}`;

  const canShowPhaseOnTodos = project.project_type && project.project_type !== "standard";

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">{project.name}</h1>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className={statusClass}>status: {project.status}</span>
            <span className={prioClass}>priority: {project.priority ?? "medium"}</span>
            {project.project_type ? <span className={metaBadgeClass()}>type: {project.project_type}</span> : null}
            {project.deadline ? <span className={metaBadgeClass()}>deadline: {project.deadline}</span> : null}
            {project.location_link ? <span className={metaBadgeClass()}>link</span> : null}
            <span className={metaBadgeClass()}>role: {workspaceRole}</span>
          </div>

          {project.description ? <p className="mt-3 text-sm text-gray-700">{project.description}</p> : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)} disabled={!canEditProject || isStakeholder}>
            Edit project
          </Button>
        </div>
      </header>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Progress</div>
            <div className="text-xs text-gray-500">
              Status of tasks is automatically calculated based on hours logged up to today.
            </div>
          </div>
          <div className="text-sm text-gray-700">
            {minutesToHoursText(executed)} / {minutesToHoursText(planned)}
          </div>
        </div>

        <div className="mt-3">
          {percent === null ? (
            <div className="text-sm text-gray-500">No estimate yet (planned = 0)</div>
          ) : (
            <ProgressBar value={percent} label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`} />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Tasks</div>
            <div className="text-xs text-gray-500">
              Drag & drop to change order. “Done” is based on logged hours (100%).
            </div>
          </div>

          <label className="text-sm flex items-center gap-2 select-none">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={hideDoneTasks}
              onChange={(e) => setHideDoneTasks(e.target.checked)}
            />
            Hide done tasks
          </label>
        </div>

        <form onSubmit={addTodo} className="mt-4 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder={canEditTodos ? "Add a task…" : "You don’t have permission to add tasks"}
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            disabled={!canEditTodos}
          />
          <Button type="submit" disabled={!canEditTodos}>
            Add
          </Button>
        </form>

        <div className="mt-4 grid gap-2">
          {sortedTodos.length === 0 ? (
            <div className="text-sm text-gray-500">No tasks</div>
          ) : (
            sortedTodos.map((t) => {
              const pctTodo = calcPct(t.executed_minutes ?? 0, t.estimated_minutes ?? 0);
              const isDragging = draggingId === t.id;
              const isOver = dragOverId === t.id;

              return (
                <div
                  key={t.id}
                  draggable={canEditTodos}
                  onDragStart={() => onDragStart(t.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    onDragOver(t.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(t.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  className={[
                    "rounded-md border bg-white p-3",
                    canEditTodos ? "cursor-move" : "cursor-default",
                    isDragging ? "opacity-60" : "",
                    isOver ? "ring-2 ring-blue-300" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{t.title}</div>

                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={metaBadgeClass()}>status: {t.auto_status}</span>
                        {t.estimated_minutes ? (
                          <span className={metaBadgeClass()}>
                            {minutesToHoursText(t.executed_minutes)} / {minutesToHoursText(t.estimated_minutes)}{" "}
                            {pctTodo === null ? "" : `(${pctTodo}%)`}
                          </span>
                        ) : (
                          <span className={metaBadgeClass()}>no estimate</span>
                        )}
                        {canShowPhaseOnTodos ? (
                          <span className={metaBadgeClass()}>
                            phase: {t.phase ?? "—"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {canEditTodos ? (
                      <Button variant="danger" className="text-xs px-2 py-1 shrink-0" onClick={() => removeTodo(t.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-gray-500">Estimate (hours)</label>
                      <input
                        className="border rounded-md px-2 py-1 text-sm"
                        defaultValue={minutesToHoursInput(t.estimated_minutes)}
                        placeholder="0"
                        inputMode="decimal"
                        disabled={!canEditTodos}
                        onBlur={(e) => updateTodoEstimate(t.id, e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-xs text-gray-500">Assignee</label>
                      <select
                        className="border rounded-md px-2 py-1 text-sm"
                        value={t.assigned_to ?? ""}
                        disabled={!canEditTodos}
                        onChange={(e) => updateTodoAssignee(t.id, e.target.value || null)}
                      >
                        <option value="">— Unassigned —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {canShowPhaseOnTodos ? (
                      <div className="grid gap-1">
                        <label className="text-xs text-gray-500">Phase</label>
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={t.phase ?? ""}
                          disabled={!canEditTodos}
                          onChange={(e) => updateTodoPhase(t.id, e.target.value || null)}
                        >
                          <option value="">— None —</option>
                          {PHASES[project.project_type as Exclude<ProjectType, "standard">].map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="hidden md:block" />
                    )}
                  </div>

                  {t.estimated_minutes && pctTodo !== null ? (
                    <div className="mt-3">
                      <ProgressBar
                        value={pctTodo}
                        label={`${minutesToHoursText(t.executed_minutes)} / ${minutesToHoursText(t.estimated_minutes)} (${pctTodo}%)`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
