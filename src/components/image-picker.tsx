"use client";

/* eslint-disable @next/next/no-img-element -- previews of any link or upload */
import { useId, useRef, useState } from "react";
import { ImageIcon, LinkIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pick a photo: upload one from this device, or paste a link to one on the
 * web. The value is the image's address ("/img/<id>" or "https://…"), "" for none.
 */
export function ImagePicker({
  value,
  onChange,
  label,
  error,
  name,
  purpose = "photo",
  preview = true,
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  error?: string;
  /** Also submit the value as a hidden form field with this name */
  name?: string;
  /** "avatar" uploads are stored smaller */
  purpose?: "photo" | "avatar";
  /** Show the chosen picture here (off when the page shows it elsewhere, like an avatar) */
  preview?: boolean;
  className?: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"buttons" | "link">("buttons");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", purpose);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      setBroken(false);
      onChange(json.url);
      setMode("buttons");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyLink(raw: string) {
    setUploadError(null);
    setBroken(false);
    onChange(raw.trim());
    setMode("buttons");
  }

  const shownError = uploadError ?? error;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </p>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      {value && preview ? (
        <div className="relative">
          {broken ? (
            <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ImageIcon className="size-4 shrink-0" aria-hidden /> That link doesn&apos;t show a picture
              </span>
            </div>
          ) : (
            <img
              src={value}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="aspect-video w-full rounded-xl bg-muted object-cover"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 h-9 rounded-full shadow"
            onClick={() => {
              onChange("");
              setBroken(false);
              setMode("buttons");
            }}
          >
            <XIcon aria-hidden /> Remove
          </Button>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />

      {mode === "link" ? (
        <div className="flex gap-2">
          <Input
            aria-labelledby={`${id}-label`}
            inputMode="url"
            placeholder="https://… link to a picture"
            defaultValue={value.startsWith("http") ? value : ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink(e.currentTarget.value);
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) applyLink(e.target.value);
            }}
            className="h-12 rounded-lg text-base md:text-sm"
            autoFocus
          />
          <Button type="button" variant="ghost" className="h-12" onClick={() => setMode("buttons")}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
            {busy ? "Uploading…" : value ? "Upload another" : "Upload a photo"}
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={() => setMode("link")}>
            <LinkIcon aria-hidden /> {value ? "Use a link instead" : "Paste a link"}
          </Button>
          {value && !preview ? (
            <Button type="button" variant="ghost" className="h-11 rounded-xl" disabled={busy} onClick={() => onChange("")}>
              <XIcon aria-hidden /> Remove
            </Button>
          ) : null}
        </div>
      )}
      {shownError ? <p className="text-sm text-destructive">{shownError}</p> : null}
    </div>
  );
}
