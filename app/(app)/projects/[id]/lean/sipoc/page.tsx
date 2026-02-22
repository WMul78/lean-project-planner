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
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  const canEdit = tier === "pro";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        await requireUser(router);

        const t = await getActiveWorkspaceTier();
        setTier(t ?? "free");

        const pr = await loadProjectLean(projectId);
        setProjectName(pr.name ?? "");

        const list = await listLeanComponents(projectId, "sipoc");
        setItems(list);
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Failed to load SIPOC list.");
        router.replace(`/projects/${projectId}/lean`);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId, router]);

  async function createNew() {
    if (!canEdit) {
      alert("SIPOC is available on the Pro plan.");
      router.push("/pricing");
      return;
    }

    try {
      const pr = await loadProjectLean(projectId);
      const comp = await createLeanComponentInstance({
        project: pr,
        componentType: "sipoc",
      });

      router.push(`/projects/${projectId}/lean/sipoc/${comp.id}`);
    } catch (e: any) {
      console.error("Create SIPOC failed:", e);
      alert(e?.message ?? "Failed to create SIPOC.");
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/lean`)}
          >
            ← Back
          </Button>

          <h1 className="text-2xl font-semibold mt-3">SIPOC</h1>

          <div className="mt-1 text-sm text-gray-600">
            Project:{" "}
            <span className="font-medium text-gray-800">
              {projectName || projectId}
            </span>
          </div>

          <div className="mt-1 text-xs text-gray-500">
            Plan: {tier}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Pricing
          </Button>
          <Button onClick={createNew} disabled={loading || !canEdit}>
            New SIPOC
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="mt-6 text-sm text-gray-500">Loading…</div>
      ) : null}

      {!loading ? (
        <section className="mt-6 grid gap-3">
          {items.length === 0 ? (
            <div className="border rounded-xl p-4 text-sm text-gray-600">
              No SIPOC diagrams created yet. Click{" "}
              <span className="font-medium">New SIPOC</span> to start.
            </div>
          ) : null}

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
                  router.push(
                    `/projects/${projectId}/lean/sipoc/${it.id}`
                  )
                }
              >
                Open
              </Button>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}