"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getActiveWorkspace, getActiveWorkspaceTier, requireUser, WorkspaceRole } from "@/app/lib/appContext";

type Priority = "low" | "medium" | "high" | "very_high";
type ProjectType = "standard" | "pdca" | "dmaic";
type ProjectStatus = "proposed" | "active" | "done" | "archived"; // later maybe "on_hold"

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;

  status: ProjectStatus;
  owner_id: string | null;
  created_by: string;

  deadline: string | null; // ISO date (YYYY-MM-DD)
  estimated_minutes: number | null;
  priority: Priority;
  project_type: ProjectType;
  phase: string | null;
  location_link: string | null;
};

type WsMemberOption = { id: string; label: string };

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
  const hours = Math.round((min / 60) * 10) / 10; // 1 decimal
  return String(hours);
}

function hoursTextToMinutes(txt: string) {
  const clean = txt.replace(",", ".").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 60);
}

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");

  const [userId, setUserId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [project, setProject] = useState<ProjectRow | null>(null);

  // active projects limit gating (existing behavior)
  const [activeLimit, setActiveLimit] = useState<number>(2);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [canActivateNow, setCanActivateNow] = useState<boolean>(true);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [projectType, setProjectType] = useState<ProjectType>("standard");
  const [phase, setPhase] = useState("");
  const [locationLink, setLocationLink] = useState("");

  // ---------------------------
  // NEW: Stakeholders
  // ---------------------------
  const [wsMembers, setWsMembers] = useState<WsMemberOption[]>([]);
  const [stakeholderIds, setStakeholderIds] = useState<string[]>([]);

  const isStakeholder = useMemo(() => workspaceRole === "stakeholder", [workspaceRole]);

  const canEdit = useMemo(() => {
    if (!userId || !project) return false;

    if (workspaceRole === "owner" || workspaceRole === "admin") return true;

    if (workspaceRole === "member") {
      if (project.owner_id === userId) return true;
      return projectMemberRole === "owner" || projectMemberRole === "editor";
    }

    // stakeholder: only edit own proposal (MVP: only if proposed + created_by=self)
    if (workspaceRole === "stakeholder") {
      return project.status === "proposed" && project.created_by === userId;
    }

    return false;
  }, [workspaceRole, project, userId, projectMemberRole]);

  async function loadStakeholders(workspaceId: string) {
    // 1) workspace members (options)
    const { data: mem, error: memErr } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(full_name,email)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (memErr) {
      console.warn("Load workspace members failed:", memErr);
      setWsMembers([]);
    } else {
      const opts: WsMemberOption[] = ((mem as any[]) ?? []).map((m) => {
        const label =
          (m.profiles?.full_name && String(m.profiles.full_name).trim()) ||
          (m.profiles?.email ? String(m.profiles.email) : null) ||
          String(m.user_id).slice(0, 8);
        return { id: String(m.user_id), label };
      });
      setWsMembers(opts);
    }

    // 2) current stakeholders on this project
    const { data: pm, error: pmErr } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);

    if (pmErr) {
      console.warn("Load project members failed:", pmErr);
      setStakeholderIds([]);
      return;
    }

    const ids = ((pm as any[]) ?? [])
      .filter((r) => String(r.role) === "stakeholder")
      .map((r) => String(r.user_id));

    setStakeholderIds(ids);
  }

  async function load() {
  setLoading(true);

  try {
    const user = await requireUser(router);
    if (!user) return;

    setUserId(user.id);

    const ws = await getActiveWorkspace();
    if (ws) setWorkspaceRole(ws.role);

    // Load effective tier (free/core/pro)
    const t = await getActiveWorkspaceTier();
    setTier(t);

    // Project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select(
        "id,workspace_id,name,description,status,owner_id,created_by,deadline,estimated_minutes,priority,project_type,phase,location_link"
      )
      .eq("id", projectId)
      .single();

    if (projErr) {
      alert(projErr.message);
      router.push(`/projects/${projectId}`);
      return;
    }

    const pr = proj as ProjectRow;
    setProject(pr);

    // Project membership role (for member collaboration)
    const { data: pm, error: pmErr } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (pmErr) console.warn("Load project member role failed:", pmErr);
    setProjectMemberRole((pm as any)?.role ?? null);

    // Precheck active count (exclude current project id)
    const limit = 2;
    setActiveLimit(limit);

    const { count, error: cntErr } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", pr.workspace_id)
      .eq("status", "active")
      .neq("id", pr.id);

    if (cntErr) {
      console.warn("Active projects count error:", cntErr);
      setActiveCount(0);
      setCanActivateNow(true);
      setLimitMsg(null);
    } else {
      const n = count ?? 0;
      setActiveCount(n);

      const ok = t !== "free" || n < limit || pr.status === "active";
      setCanActivateNow(ok);

      if (t === "free" && !ok) {
        setLimitMsg(
          `Free plan limit reached: you already have ${n}/${limit} active projects. Upgrade to activate more projects, or keep this as proposed.`
        );
      } else {
        setLimitMsg(null);
      }
    }

    // init form
    setName(pr.name ?? "");
    setDescription(pr.description ?? "");
    setDeadline(pr.deadline ?? "");
    setEstimatedHours(minutesToHoursText(pr.estimated_minutes ?? null));
    setPriority(pr.priority ?? "medium");
    setStatus(pr.status ?? "active");
    setProjectType(pr.project_type ?? "standard");
    setPhase(pr.phase ?? "");
    setLocationLink(pr.location_link ?? "");
  } catch (e: any) {
    console.error("Project edit load failed:", e);
    alert(e?.message ?? "Failed to load project.");
  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // When type changes: validate/reset phase
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

  // If free + cap reached, don't allow switching to active (UI safety)
  useEffect(() => {
    if (!project) return;
    const isSwitchingToActive = project.status !== "active" && status === "active";
    if (tier === "free" && !isStakeholder && isSwitchingToActive && !canActivateNow) {
      setStatus("proposed");
    }
  }, [tier, isStakeholder, status, canActivateNow, project]);

  const statusOptions: { value: ProjectStatus; label: string; disabled?: boolean }[] = useMemo(() => {
    if (isStakeholder) return [{ value: "proposed", label: "proposed" }];

    return [
      { value: "proposed", label: "proposed" },
      { value: "active", label: "active", disabled: tier === "free" && !canActivateNow },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ];
  }, [isStakeholder, tier, canActivateNow]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!canEdit) {
      alert("You don’t have permission to edit this project.");
      return;
    }
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) {
      alert("Name is required.");
      return;
    }

    const nextPhase = projectType === "standard" ? null : phase || null;
    const estMin = hoursTextToMinutes(estimatedHours);

    setSaving(true);

    // 1) update project (unchanged)
    const { error: upErr } = await supabase
      .from("projects")
      .update({
        name: cleanName,
        description: description.trim() || null,
        deadline: deadline ? deadline : null,
        estimated_minutes: estMin,
        priority,
        status,
        project_type: projectType,
        phase: nextPhase,
        location_link: locationLink.trim() || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", project.id);

    if (upErr) {
      console.error("Save project error:", upErr);
      alert(upErr.message);
      setSaving(false);
      return;
    }

    // 2) NEW: save stakeholders (only for non-stakeholders; keep current behavior)
    if (!isStakeholder) {
      const { error: stErr } = await supabase.rpc("set_project_stakeholders", {
        p_project_id: project.id,
        p_user_ids: stakeholderIds,
      });

      if (stErr) {
        console.error("Save stakeholders error:", stErr);
        alert(stErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/projects/${project.id}`);
  }

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-500">Loading…</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-gray-600">Project not found.</div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/projects")}>
            ← Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">Edit project</h1>

          {limitMsg ? (
            <div className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">{limitMsg}</div>
          ) : null}
        </div>
      </header>

      <form onSubmit={save} className="mt-6 grid gap-4 bg-white border rounded-lg p-6">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Name</label>
          <input className="border rounded-md px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea className="border rounded-md px-3 py-2 min-h-[90px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Deadline</label>
            <input className="border rounded-md px-3 py-2" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Estimated hours</label>
            <input
              className="border rounded-md px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g. 2.5"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select className="border rounded-md px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="very_high">very_high</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select className="border rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>

            {tier === "free" && !canActivateNow && !isStakeholder ? (
              <div className="text-xs text-amber-700 mt-1">
                You reached the free limit for active projects. Choose <b>proposed</b> or upgrade.
              </div>
            ) : null}
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Type</label>
            <select className="border rounded-md px-3 py-2" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
              <option value="standard">standard</option>
              <option value="pdca">pdca</option>
              <option value="dmaic">dmaic</option>
            </select>
          </div>
        </div>

        {projectType !== "standard" ? (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Phase</label>
            <select className="border rounded-md px-3 py-2" value={phase} onChange={(e) => setPhase(e.target.value)}>
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

        {/* ---------------------------
            NEW: Stakeholders multiselect
           --------------------------- */}
        {!isStakeholder ? (
          <div className="grid gap-2">
            <label className="text-sm font-medium">Stakeholders</label>
            <div className="text-xs text-gray-500">
              Select workspace members to grant access to this project (including chat).
            </div>

            <div className="border rounded-lg p-3 grid gap-2 max-h-64 overflow-auto">
              {wsMembers.length === 0 ? (
                <div className="text-sm text-gray-500">No workspace members found.</div>
              ) : (
                wsMembers.map((m) => {
                  const checked = stakeholderIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setStakeholderIds((cur) =>
                            e.target.checked ? Array.from(new Set([...cur, m.id])) : cur.filter((x) => x !== m.id)
                          );
                        }}
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button variant="outline" type="button" onClick={() => router.push("/projects")} disabled={saving}>
            Cancel
          </Button>
        </div>

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
