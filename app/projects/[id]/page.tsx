"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";

type Project = {
  id: string;
  name: string;
  description: string | null;
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

  const [project, setProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) router.push("/login");
    return data.user;
  }

  async function loadProject() {
    await requireUser();

    const { data, error } = await supabase
      .from("projects")
      .select("id,name,description")
      .eq("id", projectId)
      .single();

    if (error) return alert(error.message);
    setProject(data);
  }

  async function loadTodos() {
    await requireUser();

    const { data, error } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at")
      .eq("project_id", projectId)
      .order("inserted_at", { ascending: false });

    if (error) return alert(error.message);
    setTodos(data ?? []);
  }

  useEffect(() => {
    loadProject();
    loadTodos();
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
    });

    if (error) return alert(error.message);

    setTitle("");
    loadTodos();
  }

  async function toggleDone(todo: Todo) {
    const { error } = await supabase
      .from("todos")
      .update({ is_done: !todo.is_done })
      .eq("id", todo.id);

    if (error) alert(error.message);
    loadTodos();
  }

  async function removeTodo(todo: Todo) {
    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) alert(error.message);
    loadTodos();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <Button onClick={() => router.push("/projects")}>← Terug</Button>

      <h1 style={{ marginTop: 12 }}>{project?.name ?? "Project"}</h1>
      {project?.description ? <p style={{ opacity: 0.8 }}>{project.description}</p> : null}

      <form onSubmit={addTodo} style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Nieuwe actie / taak..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit">Toevoegen</Button>
      </form>

      <ul style={{ marginTop: 16, display: "grid", gap: 8, padding: 0 }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{
              listStyle: "none",
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
              <input type="checkbox" checked={t.is_done} onChange={() => toggleDone(t)} />
              <span style={{ textDecoration: t.is_done ? "line-through" : "none" }}>
                {t.title}
              </span>
            </label>
            <Button onClick={() => removeTodo(t)}>Verwijder</Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
