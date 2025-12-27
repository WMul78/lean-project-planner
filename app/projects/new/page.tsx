"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole } from "@/app/lib/appContext";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

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

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

export default function ProjectNewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [userId, setUserId] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD of ""
  const [estimatedHours, setEstimatedHours] = useState<string>("");

  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState<string>("");
  const [locationLink, setLocationLink] = useState<string>("");

  const isStakeholder = useMemo(() => role === "stakeholder", [role]);

  useEffect(() => {
    async function init() {
      setLoading(true);

      const user = await requireUser(router);
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const ws = await getActiveWorkspace();
      if (!ws?.workspaceId) {
        alert("Geen actieve workspace gevonden.");
        router.push("/projects");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);

      // Defaults per rol:
      // stakeholder: voorstel
      if (ws.role === "stakeholder") {
        setStatus("proposed");
      } else {
        setStatus("active");
      }

      setLoading(false);
    }

    init();
  }, [router]);

  // Wanneer type verandert: phase reset/valideren
  useEffect(() => {
    if (projectType === "standard") {
      if (phase !== "") setPhase("");
      return;
    }
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (phase && !allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] =
    useMemo(() => {
      // MVP: stakeholder mag alleen proposed kiezen (voorkomt dat stakeholder "active" aanmaakt)
      if (isStakeholder) {
        return [{ value: "proposed", label: "proposed" }];
      }
      return [
        { value: "proposed", label: "proposed" },
        { value: "active", label: "active" },
        { value: "done", label: "done" },
        { value: "archived", label: "archived" },
      ];
    }, [isStakeholder]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Vul een titel in.");
    if (!workspaceId || !userId) return alert("Geen workspace of gebruiker gevonden.");

    const nextDeadline = deadline ? deadline : null;
    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours);
    const nextPhase =
      projectType === "standard" ? null : (phase.trim() ? phase.trim() : null);
    const loc = locationLink.trim();

    // Stakeholder blijft forced proposed
    const nextStatus: ProjectStatus = isStakeholder ? "proposed" : status;

    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      name: cleanName,
      description: description.trim() || null,
      status: nextStatus,
      created_by: userId,

      // jouw bestaande app gebruikt owner_id (voor members vaak gelijk aan created_by)
      owner_id: isStakeholder ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      console.error("Create project error:", error);
      alert(error.message);
      return;
    }

    // navigeer naar project detail
    router.push(`/projects/${data.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Laden…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isStakeholder ? "Project voorstellen" : "Nieuw project"}
          </h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Rol: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Terug
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Titel */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Titel</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project titel"
            autoFocus
            disabled={saving}
          />
        </div>

        {/* Omschrijving */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Omschrijving</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Korte omschrijving (optioneel)"
            disabled={saving}
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
              disabled={saving}
            />
          </div>

          {/* Tijd benodigd (uren) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Tijd benodigd (uren)</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="bijv. 2 of 1.5"
              inputMode="decimal"
              disabled={saving}
            />
            <div className="text-xs text-gray-500">
              Wordt opgeslagen als minuten (estimated_minutes).
            </div>
          </div>

          {/* Prioriteit */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Prioriteit</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={saving}
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
              disabled={saving || isStakeholder}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
            {isStakeholder ? (
              <div className="text-xs text-gray-500">
                Stakeholders maken een voorstel aan (status = proposed).
              </div>
            ) : null}
          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              disabled={saving}
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
                disabled={saving}
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
            placeholder="bijv. https://... of filepad (later)"
            disabled={saving}
          />
          <div className="text-xs text-gray-500">
            MVP: vrije tekst. Later kun je validatie doen op URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Aanmaken…" : isStakeholder ? "Voorstel indienen" : "Aanmaken"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/projects")}
            disabled={saving}
          >
            Annuleren
          </Button>
        </div>
      </form>
    </main>
  );
}
