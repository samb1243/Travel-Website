// Settings a live Tripster needs. Checked when the production server starts
// (src/instrumentation.ts): missing essentials stop it with a clear message;
// missing optional services only warn, since the app works without them.

type Env = Record<string, string | undefined>;

export function checkProductionSettings(env: Env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const set = (k: string) => Boolean(env[k]?.trim());

  if (!set("DATABASE_URL")) errors.push("DATABASE_URL is not set (your Neon pooled connection string).");
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || secret.includes("replace-me")) {
    errors.push("BETTER_AUTH_SECRET must be a long random string (at least 32 characters). See DEPLOY.md, step 2, for how to make one.");
  }
  const url = env.BETTER_AUTH_URL ?? "";
  if (!/^https:\/\/[^/\s]+$/.test(url)) {
    errors.push('BETTER_AUTH_URL must be the site\'s https address with no path, e.g. "https://tripster.example.com".');
  }

  if (!set("RESEND_API_KEY") || !set("EMAIL_FROM")) {
    warnings.push("RESEND_API_KEY / EMAIL_FROM not set: password reset emails won't be sent.");
  }
  if (!set("NEXT_PUBLIC_MAPTILER_KEY")) {
    warnings.push("NEXT_PUBLIC_MAPTILER_KEY not set: maps use OpenStreetMap's own tile servers, which don't allow app traffic.");
  }
  if (!set("NOMINATIM_USER_AGENT")) {
    warnings.push("NOMINATIM_USER_AGENT not set: place search should identify the site (name and contact URL or email).");
  }
  if (set("GOOGLE_CLIENT_ID") !== set("GOOGLE_CLIENT_SECRET")) {
    warnings.push("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither: Google sign-in is off.");
  }
  return { errors, warnings };
}
