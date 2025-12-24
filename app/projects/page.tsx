"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";

type Project = {
  id: string;
  name: string;
  description: string | null;
  inserted_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const router = useRouter();

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) router.push("/login");
    return data.user;
  }

  async function loadProjects() {
    const user = await requireUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("inserted_at", { ascending: false });

    if (error) return alert(error.message);
    setProjects(data ?? []);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const user = await requireUser();
    if (!user) return;

    const clean = name.trim();
    if (!clean) return;

    // 1) project aanmaken
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .insert({ name: clean, description: description.trim() || null, owner_id: user.id })
      .select("id")
      .single();

    if (projErr) return alert(projErr.message);

    // 2) owner als member toevoegen (belangrijk voor todo policies)
    const { error: memErr } = await supabase
      .from("project_members")
      .insert({ project_id: proj.id, user_id: user.id, role: "owner" });

    if (memErr) return alert(memErr.message);

    setName("");
    setDescription("");
    loadProjects();
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1>Projecten</h1>
        <Button onClick={() => router.push("/todos")}>Naar todos</Button>
      </header>

      <form onSubmit={addProject} style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <input
          placeholder="Projectnaam (bv. Kaizen: doorlooptijd verlagen)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Omschrijving (optioneel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit">Project toevoegen</Button>
      </form>

      <ul style={{ marginTop: 16, display: "grid", gap: 10, padding: 0 }}>
        {projects.map((p) => (
          <li
            key={p.id}
            style={{
              listStyle: "none",
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {p.description ? <div style={{ opacity: 0.8 }}>{p.description}</div> : null}
            </div>
            <Button onClick={() => router.push(`/projects/${p.id}`)}>Open</Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
