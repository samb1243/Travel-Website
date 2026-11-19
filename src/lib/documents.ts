// Tickets and documents attached to bookings: what's accepted and how files
// are named. Pure functions (unit-tested); storage is src/server/documents.ts.

/** Hosts limit uploads to about 4.5 MB (Vercel); photos are shrunk in the browser first */
export const MAX_DOCUMENT_BYTES = 4_000_000;
export const MAX_DOCUMENTS_PER_ITEM = 10;
export const MAX_DOCUMENTS_PER_TRIP = 150;

export type DocumentKind = "pdf" | "image";

/** What a file really is, from its first bytes (never trust the name or the browser's type). */
export function detectDocumentKind(head: Uint8Array): DocumentKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image"; // JPEG
  if (ascii(1, 4) === "PNG") return "image";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|avif)/.test(ascii(8, 12))) return "image"; // iPhone photos
  return null;
}

/**
 * A safe, readable file name: no folders, control characters or quotes,
 * at most 100 characters, and the right extension for what's stored.
 */
export function cleanDocumentName(raw: string, kind: DocumentKind): string {
  const base = (raw.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const ext = kind === "pdf" ? ".pdf" : ".webp";
  return `${(base || (kind === "pdf" ? "Document" : "Photo")).slice(0, 100 - ext.length)}${ext}`;
}

/** "1.2 MB", "340 KB" */
export function formatFileSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
