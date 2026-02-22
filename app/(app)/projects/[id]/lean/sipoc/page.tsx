"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { requireUser, getActiveWorkspaceTier } from "@/app/lib/appContext";
import {
  listLeanComponents,
  loadProjectLean,
  createLeanComponentInstance,
} from "@/app/lib/lean";

type Params = { id: string };

export default function SipocListPage() {
  const router = useRouter();
  const { id: projectId } = useParams() as Params;

  const [items, setItems] = useState<any[]>([]);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  useEffect(() => {
    async function load() {
      await requireUser(router);
      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const list = await listLeanComponents(projectId, "sipoc");
      setItems(list);
    }

    load();
  }, [projectId, router]);

  async function createNew() {
    const pr = await loadProjectLean(projectId);
    const comp = await createLeanComponentInstance({
      project: pr,
      componentType: "sipoc",
    });

    router.push(`/projects/${projectId}/lean/sipoc/${comp.id}`);
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      
      <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/stakeholders`)}>
                  ← Back
                </Button>
      <h1 className="text-2xl font-semibold mb-4">SIPOC</h1>

      <div className="flex justify-end mb-6">
        <Button onClick={createNew} disabled={!canEdit}>
          New SIPOC
        </Button>
      </div>

      <div className="grid gap-3">
        {items.map((it) => (
          <div
            key={it.id}
            className="border rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <div className="font-medium">SIPOC Diagram</div>
              <div className="text-xs text-gray-500">
                {new Date(it.created_at).toLocaleString()}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() =>
                router.push(`/projects/${projectId}/lean/sipoc/${it.id}`)
              }
            >
              Open
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}