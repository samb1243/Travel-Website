"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileTextIcon, ImageIcon, Loader2Icon, PaperclipIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shrinkIfLarge } from "@/components/image-picker";
import { formatFileSize, MAX_DOCUMENTS_PER_ITEM } from "@/lib/documents";
import { deleteDocument } from "@/server/actions/documents";
import type { BuilderItem } from "@/server/trips";

type Doc = BuilderItem["documents"][number];

/** A document as a chip that opens it (in a new tab, so the trip stays open) */
export function DocumentChip({ doc, className }: { doc: Doc; className?: string }) {
  const Icon = doc.contentType === "application/pdf" ? FileTextIcon : ImageIcon;
  return (
    <a
      href={`/documents/${doc.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex h-10 max-w-full items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-semibold hover:bg-accent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{doc.name}</span>
    </a>
  );
}

/**
 * "Tickets & documents" in the booking form: boarding passes, e-tickets,
 * visas, confirmations. Saved with the booking straight away (no Save needed).
 */
export function DocumentsField({ itemId, documents }: { itemId: string | null; documents: Doc[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState(documents);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    if (!itemId) return;
    setBusy("upload");
    setError(null);
    try {
      const body = new FormData();
      body.set("itemId", itemId);
      // Photos are shrunk here first; PDFs go as they are
      body.set("file", file.type === "application/pdf" ? file : await shrinkIfLarge(file), file.name);
      const res = await fetch("/api/documents", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; name?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Couldn't add that file. Try again.");
      setDocs((d) => [...d, { id: json.id!, name: json.name!, contentType: file.type === "application/pdf" ? "application/pdf" : "image/webp", size: file.size }]);
      toast.success(`Added ${json.name}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that file. Try again.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(doc: Doc) {
    if (!window.confirm(`Remove “${doc.name}”?`)) return;
    setBusy(doc.id);
    try {
      await deleteDocument(doc.id);
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      router.refresh();
    } catch {
      toast.error("Couldn't remove that file. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Tickets & documents</p>
      {docs.length ? (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <DocumentChip doc={d} className="min-w-0 flex-1" />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatFileSize(d.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0"
                disabled={busy !== null}
                onClick={() => void remove(d)}
                aria-label={`Remove ${d.name}`}
              >
                {busy === d.id ? <Loader2Icon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {itemId ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void add(f);
            }}
          />
          {docs.length < MAX_DOCUMENTS_PER_ITEM ? (
            <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === "upload" ? <Loader2Icon className="animate-spin" aria-hidden /> : <PaperclipIcon aria-hidden />}
              {busy === "upload" ? "Adding…" : "Add a ticket or document"}
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            PDF or photo, up to 4 MB. Only people planning this trip can open them; they&apos;re saved for offline use with the
            trip.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">You can add tickets and documents once this is saved.</p>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
