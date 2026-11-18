import "server-only";
import sharp, { type OutputInfo } from "sharp";
import { db } from "@/lib/db";

// Photos people upload (trip covers, booking photos). Every file is decoded and
// re-encoded as WebP: that rejects anything that isn't really an image, caps
// the size, and drops camera metadata such as the GPS position a phone adds.
// Stored in the database so it works the same locally and on any host; see
// "Before going live" in the README for moving them to object storage.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1600;
/** Uploads per person per day, so the database can't be filled up */
export const MAX_UPLOADS_PER_DAY = 60;

export class UploadError extends Error {}

export async function saveUpload(userId: string, file: Blob): Promise<{ url: string }> {
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Photos can be up to 10 MB.");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await db.upload.count({ where: { userId, createdAt: { gte: since } } })) >= MAX_UPLOADS_PER_DAY) {
    throw new UploadError("That's a lot of photos for one day. Try again tomorrow, or paste a link instead.");
  }

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000, animated: false })
      .rotate() // apply the camera's orientation before the metadata is dropped
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("That doesn't look like a photo. Use a JPEG, PNG, WebP, GIF or HEIC image.");
  }

  const row = await db.upload.create({
    data: { userId, contentType: "image/webp", bytes: new Uint8Array(out.data), width: out.info.width, height: out.info.height },
    select: { id: true },
  });
  return { url: `/img/${row.id}` };
}

export async function getUpload(id: string) {
  if (!/^[a-z0-9]{20,40}$/.test(id)) return null;
  return db.upload.findUnique({ where: { id }, select: { bytes: true, contentType: true } });
}
