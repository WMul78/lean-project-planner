"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Todo = {
  id: string;
  title: string;
  is_done: boolean;
  inserted_at: string;
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const router = useRouter();

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) router.push("/login");
    return data.user;
  }

  async function loadTodos() {
    const user = await requireUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .order("inserted_at", { ascending: false });

    if (error) return alert(error.message);
    setTodos(data ?? []);
  }

  useEffect(() => {
    loadTodos();
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const user = await requireUser();
    if (!user) return;

    const clean = title.trim();
    if (!clean) return;

    const { error } = await supabase
      .from("todos")
      .insert({ title: clean, user_id: user.id });

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

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1>Mijn To-do</h1>
        <button onClick={signOut}>Uitloggen</button>
      </header>

      <form onSubmit={addTodo} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Nieuwe taak..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit">Toevoegen</button>
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

            <button onClick={() => removeTodo(t)}>Verwijder</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
