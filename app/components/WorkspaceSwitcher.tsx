"use client";

import { useEffect, useState } from "react";
import { getWorkspaceList, getActiveWorkspace, setActiveWorkspace } from "@/app/lib/appContext";
import Button from "@/app/components/Button";
import { useRouter } from "next/navigation";

type Ws = { workspaceId: string; name?: string; role: string };

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const [list, setList] = useState<Ws[]>([]);
  const [active, setActive] = useState<Ws | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const wsList = await getWorkspaceList();
      setList(wsList);

      const act = await getActiveWorkspace();
      setActive(act as any);
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
      // 1) Persist: active workspace in profile
      await setActiveWorkspace(id);

      // 2) Update local UI instantly (no extra load needed)
      const next = list.find((w) => w.workspaceId === id) ?? null;
      setActive(next);

      // 3) Tell the rest of the app to reload data
      window.dispatchEvent(new Event("workspace-changed"));

      // 4) Ensure we are on projects overview (optional)
      router.push("/projects");
    } catch (e: any) {
      console.error("Switch workspace failed:", e);
      alert(e?.message ?? "Wisselen van workspace mislukt.");
      // fallback: reload to get back to consistent state
      await load();
    } finally {
      setSwitching(false);
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
    <div className="flex items-center gap-2">
      <select
        className="border rounded-md px-2 py-1 text-sm disabled:opacity-50"
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

      {switching ? <span className="text-xs text-gray-500">wisselen…</span> : null}
    </div>
  );
}
