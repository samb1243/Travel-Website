import "server-only";
import sharp from "sharp";
import { db } from "@/lib/db";
import {
  cleanDocumentName,
  detectDocumentKind,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_ITEM,
  MAX_DOCUMENTS_PER_TRIP,
} from "@/lib/documents";
import { editableBy } from "@/server/permissions";

// Tickets and documents on bookings. Personal (names, passport numbers,
// QR codes): only ever read for someone who can edit the trip, checked on
// every request. Photos are re-encoded (dropping camera data such as GPS),
// kept sharp enough for QR codes; PDFs are kept exactly as uploaded.

export class DocumentError extends Error {}

export async function saveDocument(userId: string, itemId: string, file: Blob, rawName: string): Promise<{ id: string; name: string }> {
  const item = await db.item.findFirst({
    where: { id: itemId, trip: editableBy(userId) },
    select: { id: true, tripId: true, _count: { select: { documents: true } } },
  });
  if (!item) throw new DocumentError("not-found");
  if (item._count.documents >= MAX_DOCUMENTS_PER_ITEM) throw new DocumentError(`A booking can have up to ${MAX_DOCUMENTS_PER_ITEM} files.`);
  if ((await db.itemDocument.count({ where: { tripId: item.tripId } })) >= MAX_DOCUMENTS_PER_TRIP) {
    throw new DocumentError(`A trip can have up to ${MAX_DOCUMENTS_PER_TRIP} files.`);
  }
  if (file.size === 0) throw new DocumentError("That file is empty.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentError("Files can be up to 4 MB. For a big PDF, save just the pages you need.");

  const input = Buffer.from(await file.arrayBuffer());
  const kind = detectDocumentKind(input.subarray(0, 16));
  if (!kind) throw new DocumentError("Add a PDF or a photo (JPEG, PNG, WebP or HEIC).");

  let bytes: Buffer = input;
  let contentType = "application/pdf";
  if (kind === "image") {
    try {
      bytes = await sharp(input, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 90 }) // sharp enough for QR codes and small print
        .toBuffer();
      contentType = "image/webp";
    } catch {
      throw new DocumentError("That photo couldn't be read. Try a JPEG or PNG.");
    }
  }

  const doc = await db.itemDocument.create({
    data: {
      itemId: item.id,
      tripId: item.tripId,
      name: cleanDocumentName(rawName, kind),
      contentType,
      bytes: new Uint8Array(bytes),
      size: bytes.length,
      uploadedById: userId,
    },
    select: { id: true, name: true },
  });
  return doc;
}

/** The document, if `userId` can edit its trip; null otherwise (same as "doesn't exist"). */
export async function getDocumentFor(userId: string, id: string) {
  if (!/^[a-z0-9]{20,40}$/.test(id)) return null;
  const doc = await db.itemDocument.findUnique({
    where: { id },
    select: { tripId: true, name: true, contentType: true, bytes: true },
  });
  if (!doc) return null;
  const allowed = await db.trip.findFirst({ where: { id: doc.tripId, ...editableBy(userId) }, select: { id: true } });
  return allowed ? doc : null;
}
