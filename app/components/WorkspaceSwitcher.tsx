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
    await setActiveWorkspace(id);
    await load();
    window.dispatchEvent(new Event("workspace-changed"));
    router.refresh?.();
    router.push("/projects"); // terug naar overzicht in de gekozen workspace
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
        className="border rounded-md px-2 py-1 text-sm"
        value={active.workspaceId}
        onChange={(e) => onChange(e.target.value)}
      >
        {list.map((w) => (
          <option key={w.workspaceId} value={w.workspaceId}>
            {w.name ?? w.workspaceId} ({w.role})
          </option>
        ))}
      </select>
    </div>
  );
}
