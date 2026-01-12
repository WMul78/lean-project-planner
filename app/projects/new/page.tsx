"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";
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

  // Workspace tier
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");

  // Free limit precheck (active projects)
  const [activeCount, setActiveCount] = useState<number>(0);
  const [activeLimit, setActiveLimit] = useState<number>(2);
  const [canCreateActiveNow, setCanCreateActiveNow] = useState<boolean>(true);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

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

      // Load effective tier (free/core/pro)
      const t = await getActiveWorkspaceTier();
      setTier(t);

      // Precheck active project count (only needed for free UX, but harmless for all)
      const { count, error: cntErr } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.workspaceId)
        .eq("status", "active");

      if (cntErr) {
        console.warn("Active projects count error:", cntErr);
        setActiveCount(0);
        setActiveLimit(2);
        setCanCreateActiveNow(true);
        setLimitMsg(null);
      } else {
        const n = count ?? 0;
        setActiveCount(n);

        const limit = 2;
        setActiveLimit(limit);

        const ok = t !== "free" || n < limit;
        setCanCreateActiveNow(ok);

        if (t === "free" && !ok) {
          setLimitMsg(
            `Free plan limit reached: you already have ${n}/${limit} active projects. Upgrade to create more active projects, or create a proposal instead.`
          );
        } else {
          setLimitMsg(null);
        }
      }

      // Default status:
      // - Stakeholder: proposed
      // - Others: active (RLS enforces cap; UI will downgrade if needed)
      const canCreateActiveDefault = ws.role !== "stakeholder";
      setStatus(canCreateActiveDefault ? "active" : "proposed");

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

  // If free + active limit reached, do not keep status on "active"
  useEffect(() => {
    if (tier === "free" && !isStakeholder && status === "active" && !canCreateActiveNow) {
      setStatus("proposed");
    }
  }, [tier, isStakeholder, status, canCreateActiveNow]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
    if (isStakeholder) {
      return [{ value: "proposed", label: "proposed" }];
    }

    // Free: proposed + active (active disabled if cap reached). Done/archived only for paid tiers.
    if (tier === "free") {
      return [
        { value: "proposed", label: "proposed" },
        { value: "active", label: "active", disabled: !canCreateActiveNow },
      ];
    }

    // Core/Pro: all statuses
    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ];
  }, [isStakeholder, tier, canCreateActiveNow]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) return alert("Please enter a title.");
    if (!workspaceId || !userId) return alert("No workspace or user found.");

    // Friendly pre-check to avoid ugly RLS error
    if (tier === "free" && !isStakeholder && status === "active" && !canCreateActiveNow) {
      alert(`Free plan limit reached (${activeCount}/${activeLimit} active projects). Please upgrade or create a proposal.`);
      return;
    }

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

      // owner_id is null for proposals
      owner_id: nextStatus === "proposed" ? null : userId,

      deadline: nextDeadline,
      estimated_minutes: nextEstimatedMinutes,
      priority,
      project_type: projectType,
      phase: nextPhase,
      location_link: loc || null,
    };

    const { error } = await supabase.from("projects").insert(payload);

    setSaving(false);

    if (error) {
      const msg = (error.message ?? "Save failed").toLowerCase();

      // Map common "limit reached" errors to a nicer text
      if (msg.includes("limit") || msg.includes("can_create_active_project")) {
        alert(
          `Free plan limit reached (${activeCount}/${activeLimit} active projects). Upgrade to create more active projects, or create a proposal.`
        );
        return;
      }

      alert(error.message);
      return;
    }

    router.push("/projects");
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Add Project</h1>
        <WorkspaceSwitcher />
      </div>

      {/* Pre-warning banner for free limit */}
      {tier === "free" && limitMsg ? (
        <div className="mt-4 border rounded-lg p-3 bg-amber-50 text-amber-900 text-sm">
          <div className="font-medium">Active project limit reached</div>
          <div className="mt-1">{limitMsg}</div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => router.push("/settings/billing")}>
              Upgrade
            </Button>
            <Button variant="outline" onClick={() => setStatus("proposed")}>
              Create as proposal
            </Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="border rounded-md px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project title"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded-md px-3 py-2 min-h-[90px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input
              className="border rounded-md px-3 py-2"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 12.5"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="border rounded-md px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very high</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="border rounded-md px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Small hint under the dropdown */}
            {tier === "free" && !canCreateActiveNow ? (
              <div className="text-xs text-amber-700 mt-1">
                You reached the free limit for active projects. Choose <b>proposed</b> or upgrade.
              </div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="border rounded-md px-3 py-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
            >
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>
        </div>

        {projectType !== "standard" ? (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select
              className="border rounded-md px-3 py-2"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              <option value="">Select…</option>
              {PHASES[projectType].map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-1">
          <label className="text-sm font-medium">Location link</label>
          <input
            className="border rounded-md px-3 py-2"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="e.g. c:\\projects\\..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button variant="outline" type="button" onClick={() => router.push("/projects")} disabled={saving}>
            Cancel
          </Button>
        </div>

        {/* Debug (optioneel - kun je later weghalen) */}
        <div className="text-xs text-gray-500 pt-2">
          Plan: <span className="font-medium">{tier}</span> • Active projects:{" "}
          <span className="font-medium">
            {activeCount}/{activeLimit}
          </span>
        </div>
      </form>
    </main>
  );
}
