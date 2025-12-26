"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspace, requireUser } from "@/app/lib/appContext";

type Project = { id: string; name: string; status: string };
type TodoRow = {
  id: string;
  title: string;
  is_done: boolean;
  inserted_at: string;
  project_id: string;
  projects?: { name: string };
};

export default function TodosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");

  async function load() {
    const user = await requireUser(router);
    if (!user) return;

    const ws = await getActiveWorkspace();
    if (!ws) {
      alert("Geen workspace gevonden.");
      router.push("/projects");
      return;
    }

    const { data: projs, error: pErr } = await supabase
      .from("projects")
      .select("id,name,status")
      .eq("workspace_id", ws.workspaceId)
      .order("inserted_at", { ascending: false });

    if (pErr) alert(pErr.message);
    setProjects((projs as any) ?? []);
    if (!projectId && projs?.[0]?.id) setProjectId(projs[0].id);

    const { data: td, error: tErr } = await supabase
      .from("todos")
      .select("id,title,is_done,inserted_at,project_id,projects(name)")
      .order("inserted_at", { ascending: false });

    if (tErr) alert(tErr.message);
    setTodos((td as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const user = await requireUser(router);
    if (!user) return;

    const clean = title.trim();
    if (!clean || !projectId) return;

    const { error } = await supabase.from("todos").insert({
      title: clean,
      project_id: projectId,
    });

    if (error) return alert("Geen rechten of fout: " + error.message);
    setTitle("");
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex justify-between items-center gap-3">
        <h1 className="text-xl font-semibold">Taken</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/projects")}>Projecten</Button>
          <Button variant="outline" onClick={signOut}>Uitloggen</Button>
        </div>
      </header>

      <form onSubmit={addTodo} className="flex gap-2 mt-4">
        <select
          className="border rounded-md px-3 py-2"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.status})
            </option>
          ))}
        </select>

        <input
          className="flex-1 border rounded-md px-3 py-2"
          placeholder="Nieuwe taak..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Button type="submit">Toevoegen</Button>
      </form>

      <ul className="mt-6 grid gap-2">
        {todos.map((t) => (
          <li key={t.id} className="border rounded-lg p-3 flex justify-between items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-gray-500">
                Project: {t.projects?.name ?? t.project_id}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_done ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
              {t.is_done ? "Done" : "Open"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
