"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "proposed" | "active" | "done" | "archived";
  owner_id: string | null;
  created_by: string;
};

type Todo = {
  id: string;
  title: string;
  is_done: boolean;
  inserted_at: string;
};

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

  const canEdit = useMemo(() => {
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
      .select("id,name,description,status,owner_id,created_by")
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
      .select("id,title,is_done,inserted_at")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (tdErr) return alert(tdErr.message);
    setTodos((td as any) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    const clean = title.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
    });

    if (error) return alert("Geen rechten of fout: " + error.message);

    setTitle("");
    loadAll();
  }

  async function toggleDone(todo: Todo) {
    if (!canEdit) return;
    const { error } = await supabase
      .from("todos")
      .update({ is_done: !todo.is_done })
      .eq("id", todo.id);

    if (error) alert("Geen rechten of fout: " + error.message);
    loadAll();
  }

  async function removeTodo(todo: Todo) {
    if (!canEdit) return;
    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) alert("Geen rechten of fout: " + error.message);
    loadAll();
  }

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

      <h1 className="mt-4 text-2xl font-semibold">{project?.name ?? "Project"}</h1>
      {project?.description ? <p className="text-gray-600 mt-1">{project.description}</p> : null}
      {project ? (
        <div className="mt-2 text-sm">
          <span className="px-2 py-0.5 rounded-full bg-gray-100">{project.status}</span>
          {!canEdit ? <span className="ml-2 text-gray-500">Alleen-lezen</span> : null}
        </div>
      ) : null}

      {canEdit ? (
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
                disabled={!canEdit}
              />
              <span className={t.is_done ? "line-through text-gray-500" : ""}>{t.title}</span>
            </label>
            {canEdit ? (
              <Button variant="danger" onClick={() => removeTodo(t)}>
                Verwijder
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
