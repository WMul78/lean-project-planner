"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import ProgressBar from "@/app/components/ProgressBar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import { badgeBase, metaBadgeClass } from "@/app/lib/badges";

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
  workspace_id?: string | null; // not always selected in older code; we add it in select
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

// Simple badges (keeps existing styling patterns)
function badgeClassForStatus(s: ProjectStatus) {
  switch (s) {
    case "proposed":
      return "bg-amber-50 text-amber-900 border border-amber-200";
    case "active":
      return "bg-emerald-50 text-emerald-900 border border-emerald-200";
    case "done":
      return "bg-blue-50 text-blue-900 border border-blue-200";
    case "archived":
      return "bg-gray-50 text-gray-700 border border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function badgeClassForPriority(p: Priority | null | undefined) {
  const v = p ?? "medium";
  if (v === "very_high") return "bg-rose-50 text-rose-900 border border-rose-200";
  if (v === "high") return "bg-orange-50 text-orange-900 border border-orange-200";
  if (v === "medium") return "bg-amber-50 text-amber-900 border border-amber-200";
  return "bg-gray-50 text-gray-700 border border-gray-200";
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

  // ---- Chat state
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

  const canShowPhaseOnTodos = useMemo(() => {
    return project?.project_type && project.project_type !== "standard";
  }, [project?.project_type]);

  const unreadCount = useMemo(() => {
    if (!lastReadAt) return 0;
    const lr = new Date(lastReadAt).getTime();
    return messages.filter((m) => new Date(m.inserted_at).getTime() > lr).length;
  }, [messages, lastReadAt]);

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
      .select("id,workspace_id,name,description,status,owner_id,created_by,deadline,priority,project_type,phase,location_link")
      .eq("id", projectId)
      .single();

    if (projErr) {
      alert(projErr.message);
      router.push("/projects");
      return;
    }

    const pr = proj as Project;
    pr.phase = clampPhase(pr.project_type, pr.phase);

    setProject(pr);

    // Project membership role (for member collaboration)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    setProjectMemberRole((pm as any)?.role ?? null);
  }

  async function loadMembersForWorkspace(workspaceId: string) {
    // Used for nicer labels in UI (optional)
    const { data, error } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(full_name,email)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Load workspace members failed:", error);
      setMembers([]);
      return;
    }

    const mapped: Member[] = ((data as any[]) ?? []).map((r) => ({
      id: r.user_id,
      full_name: r.profiles?.full_name ?? "",
      email: r.profiles?.email ?? null,
    }));

    setMembers(mapped);
  }

  async function loadTodos() {
    // Prefer the view that calculates auto status based on hours
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

    const arr = ((data as any) ?? []) as TodoAuto[];
    // validate phase against project type (client safety)
    const pt = project?.project_type ?? "standard";
    for (const t of arr) t.phase = clampPhase(pt, t.phase);

    setTodos(arr);
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

  async function refreshAll() {
    await loadProject();
    await loadTodos();
    await loadTotals(projectId);
    // chat load happens separately (needs project.workspace_id)
  }

  // ---- Todos actions
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditTodos) return;

    const title = newTodoTitle.trim();
    if (!title) return;

    setNewTodoTitle("");

    const payload: any = {
      project_id: projectId,
      title,
      is_done: false,
    };

    // If project has type != standard, we can default phase
    if (project?.project_type && project.project_type !== "standard") {
      payload.phase = project.phase ?? null;
    }

    const { error } = await supabase.from("todos").insert(payload);

    if (error) {
      console.error("Add todo error:", error);
      alert(error.message);
      setNewTodoTitle(title);
      return;
    }

    await loadTodos();
    await loadTotals(projectId);
  }

  async function removeTodo(todoId: string) {
    if (!canEditTodos) return;

    const ok = window.confirm("Delete this task?");
    if (!ok) return;

    const { error } = await supabase.from("todos").delete().eq("id", todoId);

    if (error) {
      console.error("Delete todo error:", error);
      alert(error.message);
      return;
    }

    await loadTodos();
    await loadTotals(projectId);
  }

  function onDragStart(id: string) {
    if (!canEditTodos) return;
    setDraggingId(id);
  }

  function onDragOver(id: string) {
    if (!canEditTodos) return;
    if (id === draggingId) return;
    setDragOverId(id);
  }

  async function onDrop(targetId: string) {
    if (!canEditTodos) return;
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const current = [...todosRef.current];
    const fromIdx = current.findIndex((x) => x.id === draggingId);
    const toIdx = current.findIndex((x) => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);

    // optimistic sort_order (simple stable approach)
    const optimistic = current.map((t, idx) => ({ ...t, sort_order: idx }));
    setTodos(optimistic);

    setDraggingId(null);
    setDragOverId(null);

    // Persist: set sort_order for all items in the reordered list
    const payload = optimistic.map((t) => ({ id: t.id, sort_order: t.sort_order }));
    const { error } = await supabase.rpc("reorder_todos", {
      p_project_id: projectId,
      p_items: payload,
    });

    if (error) {
      console.error(error);
      alert(error.message);
      await refreshAll(); // revert to server truth
    }
  }

  // ---- Chat helpers
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

  async function loadChat(pid: string) {
    if (!userId) return;
    setMsgLoading(true);

    // 1) messages
    const { data, error } = await supabase
      .from("project_messages")
      .select("id,project_id,workspace_id,user_id,body,inserted_at")
      .eq("project_id", pid)
      .order("inserted_at", { ascending: true })
      .limit(200);

    if (error) {
      console.warn("Load chat messages failed:", error);
      setMessages([]);
      setMsgLoading(false);
      return;
    }

    setMessages(((data as any) ?? []) as ProjectMessage[]);

    // 2) last read
    const { data: rr, error: rrErr } = await supabase
      .from("project_message_reads")
      .select("last_read_at")
      .eq("project_id", pid)
      .eq("user_id", userId)
      .maybeSingle();

    if (rrErr) {
      // ok if table not present yet / rls blocks; keep null
      setLastReadAt(null);
    } else {
      setLastReadAt((rr as any)?.last_read_at ?? null);
    }

    setMsgLoading(false);
  }

  async function markChatRead(pid: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("project_message_reads")
      .upsert({
        project_id: pid,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      });

    if (error) {
      console.warn("Mark read failed:", error);
      return;
    }

    setLastReadAt(new Date().toISOString());
  }

  async function sendMessage() {
    if (!project?.workspace_id) return;
    if (!userId) return;

    const body = newMsg.trim();
    if (!body) return;

    setNewMsg("");

    const { error } = await supabase.from("project_messages").insert({
      project_id: projectId,
      workspace_id: project.workspace_id,
      user_id: userId,
      body,
    });

    if (error) {
      console.error("Send message error:", error);
      alert(error.message);
      setNewMsg(body);
      return;
    }

    // optimistic update is handled by realtime, but keep it snappy:
    await markChatRead(projectId);
  }

  // Base load
  useEffect(() => {
    (async () => {
      await loadProject();
      await loadTotals(projectId);
      // wait until project is loaded for workspace_id
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Once project is available: load related data
  useEffect(() => {
    if (!project?.id) return;

    (async () => {
      if (project.workspace_id) await loadMembersForWorkspace(project.workspace_id);
      await loadTodos();
      await loadChat(project.id);
      await markChatRead(project.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Realtime chat subscription
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
            // dedupe (rare but safe)
            if (cur.some((x) => x.id === msg.id)) return cur;
            return [...cur, msg];
          });

          // If it's my own message, auto mark as read
          if (userId && msg.user_id === userId) {
            setLastReadAt(new Date().toISOString());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, userId]);

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
            {unreadCount > 0 ? <span className={metaBadgeClass()}>unread: {unreadCount}</span> : null}
          </div>

          {project.description ? <p className="mt-3 text-sm text-gray-700">{project.description}</p> : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/edit`)}
            disabled={!canEditProject || isStakeholder}
          >
            Edit project
          </Button>
        </div>
      </header>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Progress</div>
            <div className="text-xs text-gray-500">Status of tasks is automatically calculated based on hours logged up to today.</div>
          </div>
          <div className="text-sm text-gray-700">
            {minutesToHoursText(executed)} / {minutesToHoursText(planned)}
          </div>
        </div>

        <div className="mt-3">
          {percent === null ? (
            <div className="text-sm text-gray-500">No estimate yet (planned = 0)</div>
          ) : (
            <ProgressBar
              value={percent}
              label={`${minutesToHoursText(executed)} / ${minutesToHoursText(planned)} (${percent}%)`}
            />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Tasks</div>
            <div className="text-xs text-gray-500">Drag & drop to change order. “Done” is based on logged hours (100%).</div>
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
                      <div className="font-medium text-sm break-words whitespace-normal line-clamp-2 sm:line-clamp-1">{t.title}</div>

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
                        {canShowPhaseOnTodos ? <span className={metaBadgeClass()}>phase: {t.phase ?? "—"}</span> : null}
                      </div>
                    </div>

                    {canEditTodos ? (
                      <Button
                        variant="danger"
                        className="text-xs px-2 py-1 shrink-0"
                        onClick={() => removeTodo(t.id)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ---- Chat */}
      <section className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">Project chat</div>
            <div className="text-xs text-gray-500">
              Stakeholders can read and post (based on your RLS). Realtime updates enabled.
            </div>
          </div>

          <Button
            variant="outline"
            className="text-xs px-3 py-2"
            onClick={() => markChatRead(projectId)}
            disabled={!userId}
          >
            Mark read
          </Button>
        </div>

        <div className="mt-4 border rounded-lg p-3 max-h-80 overflow-auto bg-white">
          {msgLoading ? (
            <div className="text-sm text-gray-500">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-gray-500">No messages yet.</div>
          ) : (
            <ul className="grid gap-3">
              {messages.map((m) => {
                const mine = userId && m.user_id === userId;
                return (
                  <li key={m.id} className="text-sm">
                    <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                      <span className={metaBadgeClass()}>{mine ? "you" : labelForUser(m.user_id)}</span>
                      <span className={metaBadgeClass()}>{new Date(m.inserted_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="Write a message…"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!userId}
          />
          <Button onClick={sendMessage} disabled={!userId}>
            Send
          </Button>
        </div>

        {unreadCount > 0 ? (
          <div className="mt-2 text-xs text-gray-500">Unread since last read: {unreadCount}</div>
        ) : null}
      </section>
    </main>
  );
}
