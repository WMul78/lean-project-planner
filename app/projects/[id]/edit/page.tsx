"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived"; // later evt. "on_hold"

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // date in ISO (YYYY-MM-DD)
  estimated_minutes: number | null;
  priority: Priority;
  project_type: ProjectType;
  phase: string | null;
  location_link: string | null;
};

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

function minutesToHoursText(min: number | null) {
  if (!min || min <= 0) return "";
  const hours = Math.round((min / 60) * 10) / 10; // 1 decimaal
  return String(hours);
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

export default function ProjectEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState<ProjectRow | null>(null);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD of ""
  const [estimatedHours, setEstimatedHours] = useState<string>(""); // UI in uren
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState<string>("");
  const [locationLink, setLocationLink] = useState<string>("");

  const canEdit = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: edit alleen eigen proposal (MVP: alleen als proposed + created_by=self)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  async function load() {
    setLoading(true);

    const user = await requireUser(router);
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    // Project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select(
        "id,workspace_id,name,description,status,owner_id,created_by,deadline,estimated_minutes,priority,project_type,phase,location_link"
      )
      .eq("id", projectId)
      .single();

    if (projErr) {
      setLoading(false);
      alert(projErr.message);
      router.push(`/projects/${projectId}`);
      return;
    }

    const pr = proj as ProjectRow;
    setProject(pr);

    // Project membership role (voor member samenwerking)
    const { data: pm } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    setProjectMemberRole((pm as any)?.role ?? null);

    // init form
    setName(pr.name ?? "");
    setDescription(pr.description ?? "");
    setDeadline(pr.deadline ?? "");
    setEstimatedHours(minutesToHoursText(pr.estimated_minutes));
    setPriority(pr.priority ?? "medium");
    setStatus(pr.status ?? "active");
    setProjectType(pr.project_type ?? "standard");
    setPhase(pr.phase ?? "");
    setLocationLink(pr.location_link ?? "");

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Wanneer type verandert: phase valideren/resetten
  useEffect(() => {
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (!phase) return;

    if (projectType === "standard") {
      setPhase("");
      return;
    }

    if (!allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!canEdit) return alert("Je hebt geen rechten om dit project te bewerken.");
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Vul een titel in.");

    // eenvoudige validatie locatie link
    const loc = locationLink.trim();
    if (loc && loc.length > 500) return alert("Locatie link is te lang.");

    // phase: als standard => null
    const nextPhase =
      projectType === "standard" ? null : (phase.trim() ? phase.trim() : null);

    // deadline: "" => null
    const nextDeadline = deadline ? deadline : null;

    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours); // null als leeg/invalid

    setSaving(true);

    const payload = {
      name: cleanName,
      description: description.trim() || null,
      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      status,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { error } = await supabase.from("projects").update(payload).eq("id", project.id);

    setSaving(false);

    if (error) {
      console.error("Update project error:", error);
      alert(error.message);
      return;
    }

    router.push(`/projects/${project.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Project niet gevonden.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Terug
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" onClick={() => router.push(`/projects/${project.id}`)}>
          ← Terug
        </Button>

        <div className="text-sm text-gray-500">
          Workspace rol: {workspaceRole} {projectMemberRole ? `• Project rol: ${projectMemberRole}` : ""}
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Project bewerken</h1>
      <div className="mt-1 text-sm text-gray-500">
        {project.name} {!canEdit ? "• Alleen-lezen" : null}
      </div>

      {!canEdit ? (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50 text-sm text-gray-700">
          Je hebt geen rechten om dit project te wijzigen.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Titel */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Titel</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="Project titel"
            autoFocus
          />
        </div>

        {/* Omschrijving */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Omschrijving</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="Korte omschrijving (optioneel)"
          />
        </div>

        {/* 2 koloms blok */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>

          {/* Tijd benodigd (uren) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Tijd benodigd (uren)</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="bijv. 2 of 1.5"
              inputMode="decimal"
            />
            <div className="text-xs text-gray-500">Wordt opgeslagen als minuten (estimated_minutes).</div>
          </div>

          {/* Prioriteit */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Prioriteit</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={!canEdit || saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very high</option>
            </select>
          </div>

          {/* Status */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={!canEdit || saving}
            >
              <option value="proposed">proposed</option>
              <option value="active">active</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
            <div className="text-xs text-gray-500">
              Later kun je “on_hold” toevoegen als je die status wilt ondersteunen.
            </div>
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              disabled={!canEdit || saving}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>

          {/* Fase */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Fase</label>

            {projectType === "standard" ? (
              <input
                className="border rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                value="—"
                disabled
              />
            ) : (
              <select
                className="border rounded-md px-3 py-2"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                disabled={!canEdit || saving}
              >
                <option value="">— kies fase —</option>
                {PHASES[projectType].map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Locatie */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Locatie (link)</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            disabled={!canEdit || saving}
            placeholder="bijv. https://... of filepad (later)"
          />
          <div className="text-xs text-gray-500">
            MVP: vrije tekst. Later kun je validatie doen op URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={!canEdit || saving}>
            {saving ? "Opslaan…" : "Opslaan"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push(`/projects/${project.id}`)}
            disabled={saving}
          >
            Annuleren
          </Button>
        </div>
      </form>
    </main>
  );
}
