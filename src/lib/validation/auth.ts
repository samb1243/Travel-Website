import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currencies";

// Shared by the forms (instant feedback) and the server (the real check).

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase().max(254);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const nameSchema = z.string().trim().min(1, "Enter your name").max(80, "Keep it under 80 characters");

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const profileSchema = z.object({
  name: nameSchema,
  image: z
    .union([
      z.literal(""),
      z.url({ protocol: /^https$/, message: "Use an https:// image link" }).max(500),
    ])
    .transform((v) => (v === "" ? null : v)),
  homeCurrency: z.enum(CURRENCY_CODES, "Pick a currency from the list"),
});

export { fieldErrors } from "./common";

/**
 * Server-side clean-up for user records written by Better Auth itself
 * (sign-up, Google sign-in), which skip our forms: the name is trimmed and
 * capped at 80 characters, and an avatar must be an https URL (else dropped).
 */
export function sanitizeUserFields<T extends Record<string, unknown>>(user: T): T {
  const out: Record<string, unknown> = { ...user };
  if ("name" in user) {
    const name = typeof user.name === "string" ? user.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    out.name = name || "Traveller";
  }
  if ("image" in user && user.image != null) {
    const ok = typeof user.image === "string" && user.image.length <= 1000 && /^https:\/\/[^\s]+$/i.test(user.image);
    out.image = ok ? user.image : null;
  }
  return out as T;
}
