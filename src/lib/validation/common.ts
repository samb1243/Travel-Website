import { z as zod, type z } from "zod";
import { parseDateOnly, toDateOnly } from "@/lib/dates";

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// Shared field parsers ------------------------------------------------------


/** "" -> null, otherwise trimmed text up to `max` chars. */
export const optionalText = (max: number, message = `Keep it under ${max} characters`) =>
  zod
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

/** "YYYY-MM-DD" or "" -> Date at 00:00 UTC, or null. */
export const optionalDate = zod
  .string()
  .trim()
  // abort: stop here so later rules (e.g. "end after start") never see a bad value
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Use a valid date", abort: true })
  // Real calendar dates only: "2027-02-30" would otherwise roll over to 2 March.
  .refine((v) => v === "" || toDateOnly(parseDateOnly(v)) === v, { message: "Use a valid date", abort: true })
  .transform((v) => (v === "" ? null : parseDateOnly(v)));

/** "HH:MM" or "" */
export const optionalTime = zod
  .string()
  .trim()
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use a time like 09:30")
  .transform((v) => (v === "" ? null : v));

/** "1,500.50" -> 1500.5, "" -> null. Non-negative, max 2 decimals. */
export const optionalMoney = zod
  .string()
  .trim()
  .transform((v) => v.replace(/[\s,]/g, ""))
  .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount like 45 or 45.50")
  .transform((v) => (v === "" ? null : Number(v)));

/** Path of an image uploaded to Tripster (see src/app/img/[id]/route.ts) */
export const UPLOAD_PATH = /^\/img\/[a-z0-9]{20,40}$/;

/** An image: an https:// link, or a photo uploaded here. "" = none. */
export const optionalImageUrl = zod
  .union([
    zod.literal(""),
    zod.string().regex(UPLOAD_PATH, "Upload the photo again"),
    zod.url({ protocol: /^https$/, message: "Use an https:// image link" }).max(1000),
  ])
  .nullish()
  .transform((v) => v || null);
