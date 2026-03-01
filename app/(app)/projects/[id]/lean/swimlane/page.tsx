"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/app/components/Button";
import { getActiveWorkspaceTier, requireUser } from "@/app/lib/appContext";
import { supabase } from "@/lib/supabaseClient";

type Params = { id: string; componentId: string };

export default function VsmDetailPage() {
  const router = useRouter();
  const { id: projectId, componentId } = useParams() as any as Params;

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"free" | "core" | "pro">("free");
  const canEdit = tier === "pro";

  const [title, setTitle] = useState("Swimlane (External)");
  const [externalUrl, setExternalUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function debounceSave(key: string, fn: () => Promise<void>) {
    const timers = saveTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        console.error("Save failed:", e);
      }
    }, 450);
  }

  function deriveEmbedUrl(url: string) {
    const u = (url || "").trim();
    if (!u) return "";

    // Google Drive file link -> preview embed
    // Examples:
    // https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing
    // => https://drive.google.com/file/d/<FILE_ID>/preview
    const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (m?.[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;

    // If user already pasted a /preview link, keep it
    if (u.includes("drive.google.com") && u.includes("/preview")) return u;

    // OneDrive embed is usually already an embed link. Keep as-is.
    // Otherwise: default to the same URL (may or may not allow iframing)
    return u;
  }

  async function load() {
    setLoading(true);
    try {
      await requireUser(router);
      const t = await getActiveWorkspaceTier();
      setTier(t ?? "free");

      const { data, error } = await supabase
        .from("lean_external_diagrams")
        .select("title, external_url, embed_url, notes")
        .eq("component_id", componentId)
        .single();

      if (error) throw error;

      setTitle(data?.title ?? "VSM (External)");
      setExternalUrl(data?.external_url ?? "");
      setEmbedUrl(data?.embed_url ?? "");
      setNotes(data?.notes ?? "");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load VSM.");
      router.replace(`/projects/${projectId}/lean/vsm`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentId]);

  function updateField<K extends "title" | "external_url" | "embed_url" | "notes">(key: K, value: string) {
    if (key === "title") setTitle(value);
    if (key === "external_url") setExternalUrl(value);
    if (key === "embed_url") setEmbedUrl(value);
    if (key === "notes") setNotes(value);

    debounceSave(`meta:${componentId}`, async () => {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };

      payload[key] = value || null;

      // If external_url changes and embed_url is empty, we auto-derive on save (nice UX)
      if (key === "external_url") {
        const derived = deriveEmbedUrl(value);
        if (!embedUrl) payload.embed_url = derived || null;
      }

      const { error } = await supabase
        .from("lean_external_diagrams")
        .update(payload)
        .eq("component_id", componentId);

      if (error) throw error;
    });
  }

  const effectiveEmbedUrl = (embedUrl || deriveEmbedUrl(externalUrl)).trim();

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/lean/vsm`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold mt-3">VSM (External)</h1>
          <div className="mt-1 text-xs text-gray-500">Plan: {tier}</div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const u = externalUrl.trim();
              if (!u) return alert("Please paste an external URL first.");
              window.open(u, "_blank", "noopener,noreferrer");
            }}
          >
            Open link
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowPreview((v) => !v)}
            disabled={!effectiveEmbedUrl}
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </Button>
        </div>
      </header>

      {loading ? <div className="mt-6 text-sm text-gray-500">Loading…</div> : null}

      {!loading ? (
        <section className="mt-6 grid gap-4">
          <div className="border rounded-xl p-4 bg-white grid gap-3">
            <div>
              <div className="text-sm font-medium">Title</div>
              <input
                className="mt-2 w-full border rounded-md px-3 py-2"
                value={title}
                disabled={!canEdit}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm font-medium">External URL</div>
              <div className="text-xs text-gray-500 mt-1">
                Tip: for embed preview, use a Google Drive file link (we auto-convert to /preview).
              </div>
              <input
                className="mt-2 w-full border rounded-md px-3 py-2"
                value={externalUrl}
                disabled={!canEdit}
                onChange={(e) => updateField("external_url", e.target.value)}
                placeholder="Paste share link (Drive/OneDrive/other)"
              />
            </div>

            <div>
              <div className="text-sm font-medium">Embed URL (optional)</div>
              <div className="text-xs text-gray-500 mt-1">
                If preview does not work, paste a direct embed/preview URL here.
              </div>
              <input
                className="mt-2 w-full border rounded-md px-3 py-2"
                value={embedUrl}
                disabled={!canEdit}
                onChange={(e) => updateField("embed_url", e.target.value)}
                placeholder="e.g. https://drive.google.com/file/d/FILE_ID/preview"
              />
            </div>

            <div>
              <div className="text-sm font-medium">Notes</div>
              <textarea
                className="mt-2 w-full border rounded-md px-3 py-2 min-h-[90px]"
                value={notes}
                disabled={!canEdit}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional notes about this diagram"
              />
            </div>
          </div>

          {showPreview && effectiveEmbedUrl ? (
            <div className="border rounded-xl bg-white p-3">
              <div className="text-sm font-medium px-1 pb-2">Preview</div>
              <iframe
                src={effectiveEmbedUrl}
                className="w-full h-[720px] border rounded-xl"
                allow="clipboard-read; clipboard-write"
              />
              <div className="text-xs text-gray-500 mt-2 px-1">
                If preview is blank, the host may block embedding. Use Google Drive preview link or open in new tab.
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}