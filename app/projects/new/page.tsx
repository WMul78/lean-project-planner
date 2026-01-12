"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, requireUser, WorkspaceRole, getActiveWorkspaceTier } from "@/app/lib/appContext";
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

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD or ""
  const [estimatedHours, setEstimatedHours] = useState<string>("");

  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState<string>("");
  const [locationLink, setLocationLink] = useState<string>("");

  const isStakeholder = useMemo(() => role === "stakeholder", [role]);

const [tier, setTier] = useState<"free" | "core" | "pro">("free");


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
        alert("No active workspace found.");
        router.push("/projects");
        return;
      }

      setWorkspaceId(ws.workspaceId);
      setRole(ws.role);
      
// Workspace tier (free/core/pro) via RPC workspace_effective_tier
const t = await getActiveWorkspaceTier();
setTier(t);

// Defaults per role + tier:
// - Stakeholder => proposals only
// - Non-stakeholder: allow 'active' by default (RLS will enforce free limits)
const canCreateActive = ws.role !== "stakeholder";
setStatus(canCreateActive ? "active" : "proposed");



      setLoading(false);
    }

    init();
  }, [router]);

  // When project type changes: reset/validate phase
  useEffect(() => {
    if (projectType === "standard") {
      if (phase !== "") setPhase("");
      return;
    }
    const allowed = new Set(PHASES[projectType].map((p) => p.value));
    if (phase && !allowed.has(phase)) setPhase("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  const isPaid = tier === "core" || tier === "pro";
  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
  // Stakeholders can only propose
  if (isStakeholder) {
    return [{ value: "proposed", label: "proposed" }];
  }

  // Free: allow proposed + active (done/archived only paid)
  if (tier === "free") {
    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active" },
    ];
  }

  // Core/Pro: all statuses
  return [
    { value: "proposed", label: "proposed" },
    { value: "active", label: "active" },
    { value: "done", label: "done" },
    { value: "archived", label: "archived" },
  ];
}, [isStakeholder, tier]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Please enter a title.");
    if (!workspaceId || !userId) return alert("No workspace or user found.");

    const nextDeadline = deadline ? deadline : null;
    const nextEstimatedMinutes = hoursTextToMinutes(estimatedHours);
    const nextPhase = projectType === "standard" ? null : phase.trim() ? phase.trim() : null;
    const loc = locationLink.trim();

    // Stakeholder stays forced proposed
const nextStatus: ProjectStatus = isStakeholder ? "proposed" : status;

    setSaving(true);

    const payload: any = {
      workspace_id: workspaceId,
      name: cleanName,
      description: description.trim() || null,
      status: nextStatus,
      // created_by: userId,

      // The app uses owner_id (for members often equal to created_by)
      owner_id: nextStatus === "proposed" ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { data, error } = await supabase.from("projects").insert(payload).select("id").single();

    setSaving(false);

    if (error) {
      console.error("Create project error:", error);
      alert(error.message);
      return;
    }

    // Navigate to project detail
    router.push(`/projects/${data.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isStakeholder ? "Propose project" : "New project"}
          </h1>

          <div className="mt-2">
            <WorkspaceSwitcher />
          </div>

          <div className="text-sm text-gray-500">Role: {role}</div>
          {workspaceId ? (
            <div className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono">{workspaceId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 items-end">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        {/* Title */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project title"
            autoFocus
            disabled={saving}
          />
        </div>

        {/* Description */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            disabled={saving}
          />
        </div>

        {/* Two-column block */}
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

          {/* Estimated hours */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 2"
              inputMode="decimal"
              disabled={saving}
            />
            <div className="text-xs text-gray-500">Leave empty if unknown.</div>
          </div>

          {/* Priority */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={saving}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          {/* Status */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={saving || isStakeholder || !isPaid}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
            {isStakeholder ? (
  <div className="text-xs text-gray-500">Stakeholders can only create proposals.</div>
) : !isPaid ? (
  <div className="text-xs text-gray-500">
    You are on the free plan. Projects will be submitted as proposals.
  </div>
) : null}

          </div>

          {/* Type */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Project type</label>
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

          {/* Phase (only for pdca/dmaic) */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select
              className="border rounded-md px-3 py-2"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              disabled={saving || projectType === "standard"}
            >
              <option value="">—</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              Only applicable for PDCA/DMAIC projects.
            </div>
          </div>
        </div>

        {/* Location link */}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. https://... or a file path (later)"
            disabled={saving}
          />
          <div className="text-xs text-gray-500">
            MVP: free text. Later you can validate URL vs file path.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : isStakeholder ? "Submit proposal" : "Create"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/projects")}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
