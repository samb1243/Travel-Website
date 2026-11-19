import { checkProductionSettings } from "@/lib/env-check";

/**
 * Runs once when a server instance starts. In production, refuses to start
 * without the essential settings (so a misconfigured deploy fails loudly
 * instead of half-working) and warns about missing optional services.
 */
export function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  // A production build run on your own computer (`npm run build && npm start`)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BETTER_AUTH_URL ?? "")) return;
  const { errors, warnings } = checkProductionSettings(process.env);
  for (const w of warnings) console.warn(`[settings] ${w}`);
  if (errors.length) {
    throw new Error(`Tripster can't start; fix these settings:\n- ${errors.join("\n- ")}`);
  }
}
