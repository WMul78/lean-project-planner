"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { supabase } from "@/lib/supabaseClient";
import { getWorkspaceList, getActiveWorkspace, setActiveWorkspace } from "@/app/lib/appContext";

type Ws = { workspaceId: string; name?: string; role: string };

export default function WorkspaceSwitcher() {
  const router = useRouter();

  const [list, setList] = useState<Ws[]>([]);
  const [active, setActive] = useState<Ws | null>(null);

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // create + rename UI
  const [showManage, setShowManage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const [newWsName, setNewWsName] = useState("");
  const [renameWsName, setRenameWsName] = useState("");

  const canRename = useMemo(() => {
    const r = active?.role;
    return r === "owner" || r === "admin";
  }, [active?.role]);

  async function load() {
    setLoading(true);
    try {
      const wsList = await getWorkspaceList();
      setList(wsList);

      const act = await getActiveWorkspace();
      setActive(act as any);

      setRenameWsName((act as any)?.name ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onChange(id: string) {
    if (!id || id === active?.workspaceId) return;

    setSwitching(true);
    try {
      await setActiveWorkspace(id);

      const next = list.find((w) => w.workspaceId === id) ?? null;
      setActive(next);
      setRenameWsName(next?.name ?? "");

      window.dispatchEvent(new Event("workspace-changed"));
      router.push("/projects");
    } catch (e: any) {
      console.error("Switch workspace failed:", e);
      alert(e?.message ?? "Wisselen van workspace mislukt.");
      await load();
    } finally {
      setSwitching(false);
    }
  }

  async function createWorkspace() {
    const name = newWsName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const { data: newId, error } = await supabase.rpc("create_workspace", { p_name: name });
      if (error) throw error;

      setNewWsName("");

      await load();

      if (newId) {
        await setActiveWorkspace(newId as any);
      }

      window.dispatchEvent(new Event("workspace-changed"));
      router.push("/projects");
    } catch (e: any) {
      console.error("Create workspace failed:", e);
      alert(e?.message ?? "Workspace aanmaken mislukt.");
    } finally {
      setCreating(false);
    }
  }

  async function renameWorkspace() {
    if (!active?.workspaceId) return;
    if (!canRename) return;

    const name = renameWsName.trim();
    if (!name) return;

    setRenaming(true);
    try {
      const { error } = await supabase.from("workspaces").update({ name }).eq("id", active.workspaceId);
      if (error) throw error;

      setList((prev) => prev.map((w) => (w.workspaceId === active.workspaceId ? { ...w, name } : w)));
      setActive((prev) => (prev ? { ...prev, name } : prev));

      window.dispatchEvent(new Event("workspace-changed"));
    } catch (e: any) {
      console.error("Rename workspace failed:", e);
      alert(e?.message ?? "Workspace naam wijzigen mislukt.");
      await load();
    } finally {
      setRenaming(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Workspace: laden…</div>;

  if (!active || list.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-600">Geen workspace</div>
        <Button variant="outline" onClick={() => router.push("/invites")}>
          Invite accepteren
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 w-full">
      {/* Row 1: switcher + manage toggle */}
      <div className="flex items-center gap-2 w-full flex-wrap">
        <div className="flex-1 min-w-0">
          <select
            className="w-full border rounded-md px-2 py-2 text-sm disabled:opacity-50"
            value={active.workspaceId}
            onChange={(e) => onChange(e.target.value)}
            disabled={switching}
          >
            {list.map((w) => (
              <option key={w.workspaceId} value={w.workspaceId}>
                {w.name ?? w.workspaceId} ({w.role})
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowManage((v) => !v)}
          aria-label="Workspace actions"
          className="px-3 py-2 shrink-0"
        >
          ⋯
        </Button>

        {switching ? <span className="text-xs text-gray-500 shrink-0">wisselen…</span> : null}
      </div>

      {/* Row 2: manage panel */}
      {showManage ? (
        <div className="border rounded-lg p-3 bg-gray-50 grid gap-3 w-full">
          {/* Create */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Nieuwe workspace</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm"
                placeholder="Naam…"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
              />
              <Button onClick={createWorkspace} disabled={creating || newWsName.trim().length === 0} className="shrink-0">
                {creating ? "Aanmaken…" : "Aanmaken"}
              </Button>
            </div>
          </div>

          {/* Rename */}
          <div className="grid gap-1">
            <div className="text-xs text-gray-600 font-medium">Huidige workspace naam</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm"
                placeholder="Nieuwe naam…"
                value={renameWsName}
                onChange={(e) => setRenameWsName(e.target.value)}
                disabled={!canRename}
              />
              <Button
                variant="outline"
                onClick={renameWorkspace}
                disabled={!canRename || renaming || renameWsName.trim().length === 0}
                className="shrink-0"
              >
                {renaming ? "Opslaan…" : "Opslaan"}
              </Button>
            </div>
            {!canRename ? (
              <div className="text-xs text-gray-500">Alleen owner/admin kan de naam wijzigen.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
