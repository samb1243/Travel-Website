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

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
