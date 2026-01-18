"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived";

const PHASES: Record<ProjectType, { value: string; label: string }[]> = {
  standard: [],
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

  // Used for chat insert
  workspace_id?: string | null;
};

type TodoAuto = {
  id: string;
  project_id: string;
  title: string;
  inserted_at: string;
  assigned_to: string | null;
  estimated_minutes: number | null;
  executed_minutes: number;
  auto_status: "proposed" | "active" | "done";
  phase: string | null;
  sort_order: number | null;
};

type Member = { id: string; full_name: string; email: string | null };

type ProjectMessage = {
  id: string;
  project_id: string;
  workspace_id: string;
  user_id: string;
  body: string;
  inserted_at: string;
};

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

function badgeClassForTodoStatus(s: TodoAuto["auto_status"]) {
  switch (s) {
    case "proposed":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "active":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "done":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}


const badgeBase = "inline-flex items-center px-2 py-1 rounded-full text-xs border";

function badgeClassForStatus(s: ProjectStatus) {
  switch (s) {
    case "proposed":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "active":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "done":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "archived":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function badgeClassForPriority(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return "bg-rose-50 text-rose-900 border-rose-200";
  if (v === "high") return "bg-orange-50 text-orange-900 border-orange-200";
  if (v === "medium") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  // Page state
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Auth / roles
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  // Data
  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<TodoAuto[]>([]);
  const todosRef = useRef<TodoAuto[]>([]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const [members, setMembers] = useState<Member[]>([]);
  const [plannedMinutes, setPlannedMinutes] = useState<number>(0);
  const [executedMinutes, setExecutedMinutes] = useState<number>(0);

  // UI
  const [hideDoneTasks, setHideDoneTasks] = useState<boolean>(true);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // Drag/drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Chat
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

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
    const arr = [...filteredTodos];
    arr.sort((a, b) => {
      const ao = a.sort_order ?? 1_000_000;
      const bo = b.sort_order ?? 1_000_000;
      if (ao !== bo) return ao - bo;
      return a.inserted_at < b.inserted_at ? -1 : 1;
    });
    return arr;
  }, [filteredTodos]);

  const labelForUser = useCallback(
    (uid: string) => {
      const m = members.find((x) => x.id === uid);
      if (!m) return uid.slice(0, 8);
      const name = (m.full_name ?? "").trim();
      if (name) return name;
      return m.email ?? uid.slice(0, 8);
    },
    [members]
  );

  const unreadCount = useMemo(() => {
    if (!lastReadAt) return 0;
    const lr = new Date(lastReadAt).getTime();
    return messages.filter((m) => new Date(m.inserted_at).getTime() > lr).length;
  }, [messages, lastReadAt]);

  // ---------------------------
  // Loaders
  // ---------------------------
  async function loadProject(): Promise<{ userId: string; workspaceId: string } | null> {
  const user = await requireUser(router);
  if (!user) return null;
  setUserId(user.id);

  const ws = await getActiveWorkspace();
  if (!ws?.workspaceId) {
    alert("No active workspace found.");
    router.push("/projects");
    return null;
  }
  setWorkspaceRole(ws.role);

  const { data: proj, error: projErr } = await supabase
    .from("projects")
    .select("id,workspace_id,name,description,status,owner_id,created_by,deadline,priority,project_type,phase,location_link")
    .eq("id", projectId)
    .single();

  if (projErr) {
    console.error("Load project failed:", projErr);
    alert(projErr.message);
    router.push("/projects");
    return null;
  }

  setProject(proj as Project);

  const { data: pm } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  setProjectMemberRole((pm as any)?.role ?? null);

  return { userId: user.id, workspaceId: ws.workspaceId };
}


  async function loadTodos() {
    const { data, error } = await supabase
      .from("todo_status_auto")
      .select(
        "id,project_id,title,inserted_at,assigned_to,estimated_minutes,executed_minutes,auto_status,phase,sort_order"
      )
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

  // ---------------------------
  // Chat
  // ---------------------------
  async function loadChat(pid: string) {
  setMsgLoading(true);
  try {
    const { data, error } = await supabase
      .from("project_messages")
      .select("id,project_id,workspace_id,user_id,body,inserted_at")
      .eq("project_id", pid)
      .order("inserted_at", { ascending: true });

    if (error) {
      console.error("Load chat failed:", error);
      setMessages([]);
      return;
    }

    setMessages(((data as any) ?? []) as ProjectMessage[]);
  } finally {
    setMsgLoading(false);
  }
}

async function markChatRead(pid: string, uid: string) {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("project_message_reads").upsert({
    project_id: pid,
    user_id: uid,
    last_read_at: nowIso,
  });

  if (error) {
    console.warn("Mark read failed:", error);
    return;
  }

  setLastReadAt(nowIso);
}

async function loadChatReadState(pid: string, uid: string) {
  const { data, error } = await supabase
    .from("project_message_reads")
    .select("last_read_at")
    .eq("project_id", pid)
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("Load read state failed:", error);
    setLastReadAt(null);
    return;
  }

  setLastReadAt((data as any)?.last_read_at ?? null);
}


  async function sendMessage() {
  if (!project?.workspace_id) {
    alert("Project workspace_id missing (required for chat insert).");
    return;
  }
  if (!userId) return;

  const body = newMsg.trim();
  if (!body) return;

  setNewMsg("");

  // Optimistic UI: show immediately
  const optimistic: ProjectMessage = {
    id: `tmp-${Date.now()}`,
    project_id: projectId,
    workspace_id: project.workspace_id,
    user_id: userId,
    body,
    inserted_at: new Date().toISOString(),
  };
  setMessages((cur) => [...cur, optimistic]);

  const { error } = await supabase.from("project_messages").insert({
    project_id: projectId,
    workspace_id: project.workspace_id,
    user_id: userId,
    body,
  });

  if (error) {
    console.error("Send message error:", error);
    alert(error.message);

    // rollback optimistic
    setMessages((cur) => cur.filter((m) => m.id !== optimistic.id));
    setNewMsg(body);
    return;
  }

  // Always reload chat from DB so you see the real row (id/inserted_at)
  await loadChat(projectId);
  await markChatRead(projectId, userId);
}


  // ---------------------------
  // Bootstrap: safe & cancellable
  // ---------------------------
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setPageLoading(true);
      setPageError(null);

      try {
        const ctx = await loadProject();
          if (!ctx) {
           // Critical: don’t leave the UI in a "Loading…" limbo
            if (!cancelled) {
              setPageError("No user/workspace context found. Please refresh or log in again.");
              setPageLoading(false); // <-- explicit
           }
            return; // <-- stop bootstrap
          }


        await loadTodos();
        await loadWorkspaceMembers();
        await loadTotals(projectId);

        await loadChat(projectId);
        await loadChatReadState(projectId, ctx.userId); // <-- this sets lastReadAt
        await markChatRead(projectId, ctx.userId);      // <-- optionally mark immediately as read
      } catch (e: any) {
        console.error("Project detail bootstrap failed:", e);
        if (!cancelled) setPageError(e?.message ?? "Failed to load project details.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Realtime subscription for chat (INSERT only)
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const msg = payload.new as any as ProjectMessage;

          setMessages((cur) => {
            if (cur.some((x) => x.id === msg.id)) return cur;
            return [...cur, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // ---------------------------
  // Todos CRUD
  // ---------------------------
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;
    if (!project) return;

    const clean = newTodoTitle.trim();
    if (!clean) return;

    // compute next sort_order client-side
    const current = todosRef.current.filter((t) => t.project_id === projectId);
    const maxSort = current.reduce((mx, t) => Math.max(mx, t.sort_order ?? 0), 0);

    const defaultPhase =
      project.project_type && project.project_type !== "standard"
        ? clampPhase(project.project_type, project.phase)
        : null;

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

  // Drag & drop reorder (persist sort_order)
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

    const cur = sortedTodos;
    const fromIdx = cur.findIndex((t) => t.id === fromId);
    const toIdx = cur.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...cur];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Persist: assign new sort_order sequentially
    // If you already have an RPC reorder_todos, you can call it here instead.
    for (let i = 0; i < next.length; i++) {
      const t = next[i];
      // only update if changed to reduce writes
      const desired = i + 1;
      if ((t.sort_order ?? 0) !== desired) {
        const { error } = await supabase.from("todos").update({ sort_order: desired }).eq("id", t.id);
        if (error) {
          console.warn("Reorder update failed:", error);
          break;
        }
      }
    }

    await refreshAll();
  }

  // ---------------------------
  // Render states
  // ---------------------------
  if (pageLoading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-red-700 font-medium">Could not load project</div>
        <div className="mt-2 text-sm text-gray-600">{pageError}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </main>
    );
  }

  if (!project) {
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="text-gray-700 font-medium">Project not loaded</div>
      <div className="mt-2 text-sm text-gray-600">
        This can happen if the session/workspace context wasn’t available yet.
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          ← Back
        </Button>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
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

          <h1 className="text-2xl font-semibold mt-3 break-words">{project.name}</h1>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className={statusClass}>{project.status}</span>
            <span className={prioClass}>{project.priority ?? "medium"}</span>
            {project.project_type ? (
              <span className={`${badgeBase} bg-white text-gray-700 border-gray-200`}>{project.project_type}</span>
            ) : null}
            {project.deadline ? (
              <span className={`${badgeBase} bg-white text-gray-700 border-gray-200`}>Deadline: {project.deadline}</span>
            ) : null}
          </div>

          {project.description ? <p className="mt-3 text-sm text-gray-700">{project.description}</p> : null}

          <div className="mt-4 rounded-lg border bg-white p-3">
            <div className="text-sm font-medium text-gray-900">Progress</div>
            <div className="mt-2 text-sm text-gray-700">
              Planned: <span className="font-medium">{minutesToHoursText(planned)}</span> • Executed:{" "}
              <span className="font-medium">{minutesToHoursText(executed)}</span>
              {percent === null ? null : (
                <>
                  {" "}
                  • <span className="font-medium">{percent}%</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {canEditProject ? (
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              Edit project
            </Button>
          ) : null}

          <Button variant="outline" onClick={refreshAll}>
            Refresh
          </Button>
        </div>
      </header>

      {/* Todos */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tasks</h2>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideDoneTasks}
              onChange={(e) => setHideDoneTasks(e.target.checked)}
            />
            Hide done
          </label>
        </div>

        {canEditTodos ? (
          <form onSubmit={addTodo} className="mt-3 flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add a task…"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
            />
            <Button type="submit">Add</Button>
          </form>
        ) : isStakeholder ? (
          <div className="mt-3 text-sm text-gray-500">Stakeholders can’t edit tasks.</div>
        ) : null}

        <ul className="mt-4 grid gap-2">
          {sortedTodos.length === 0 ? (
            <li className="text-sm text-gray-600">No tasks.</li>
          ) : (
            sortedTodos.map((t) => (
              <li
                key={t.id}
                draggable={canEditTodos}
                onDragStart={() => onDragStart(t.id)}
                onDragOver={(e) => {
                  if (!canEditTodos) return;
                  e.preventDefault();
                  onDragOver(t.id);
                }}
                onDrop={(e) => {
                  if (!canEditTodos) return;
                  e.preventDefault();
                  onDrop(t.id);
                }}
                className={[
                  "border rounded-lg bg-white p-3",
                  dragOverId === t.id ? "ring-2 ring-blue-400" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{t.title}</div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className={`${badgeBase} ${badgeClassForTodoStatus(t.auto_status)}`}>
                        {t.auto_status}
                      </span>
                      <span className={`${badgeBase} bg-white border-gray-200 text-gray-700`}>
                        Est: {minutesToHoursText(t.estimated_minutes)}
                      </span>
                      <span className={`${badgeBase} bg-white border-gray-200 text-gray-700`}>
                        Exec: {minutesToHoursText(t.executed_minutes)}
                      </span>
                      {canShowPhaseOnTodos ? (
                        <span className={`${badgeBase} bg-white border-gray-200 text-gray-700`}>
                          Phase: {t.phase ?? "—"}
                        </span>
                      ) : null}
                    </div>

                    {/* Editors */}
                    {canEditTodos ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-gray-500">Estimate (hours)</div>
                          <input
                            className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            defaultValue={minutesToHoursInput(t.estimated_minutes)}
                            onBlur={(e) => updateTodoEstimate(t.id, e.target.value)}
                            placeholder="e.g. 1.5"
                          />
                        </div>

                        <div>
                          <div className="text-xs text-gray-500">Assignee</div>
                          <select
                            className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                            value={t.assigned_to ?? ""}
                            onChange={(e) => updateTodoAssignee(t.id, e.target.value ? e.target.value : null)}
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {labelForUser(m.id)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {canShowPhaseOnTodos ? (
                          <div>
                            <div className="text-xs text-gray-500">Phase</div>
                            <select
                              className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                              value={t.phase ?? ""}
                              onChange={(e) => updateTodoPhase(t.id, e.target.value ? e.target.value : null)}
                            >
                              <option value="">—</option>
                              {PHASES[(project.project_type as ProjectType) ?? "standard"].map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div />
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {canEditTodos ? (
                      <Button variant="danger" onClick={() => removeTodo(t.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Chat */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Chat{" "}
            {unreadCount > 0 ? (
              <span className="ml-2 text-xs px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900">
                {unreadCount} unread
              </span>
            ) : null}
          </h2>

          <Button
            variant="outline"
            onClick={async () => {
              await loadChat(projectId);
              if (userId) await markChatRead(projectId, userId);
            }}
          >
            Refresh
          </Button>
        </div>

        {msgLoading ? <div className="mt-3 text-sm text-gray-500">Loading chat…</div> : null}

        <div className="mt-3 border rounded-lg bg-white">
          <div className="max-h-[320px] overflow-auto p-3 grid gap-2">
            {messages.length === 0 ? (
              <div className="text-sm text-gray-600">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{labelForUser(m.user_id)}</span> •{" "}
                    {new Date(m.inserted_at).toLocaleString()}
                  </div>
                  <div className="text-gray-900 whitespace-pre-wrap">{m.body}</div>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write a message…"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onFocus={() => {
                  if (userId) markChatRead(projectId, userId);
                }}
              />
              <Button
                onClick={async () => {
                  await sendMessage();
                  await loadChat(projectId);
                }}
              >
                Send
              </Button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Tip: make sure <span className="font-medium">Realtime</span> is enabled for{" "}
              <span className="font-medium">project_messages</span> in Supabase if live updates don’t appear.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
