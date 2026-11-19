import "dotenv/config";

/**
 * The browser tests use their own database next to the dev one
 * (tripstack → tripstack_e2e), reset and filled with the demo data on every
 * run, so they never touch your data. Override with E2E_DATABASE_URL.
 */
export function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const dev = process.env.DATABASE_URL;
  if (!dev) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const url = new URL(dev);
  url.pathname = `${url.pathname.replace(/\/$/, "")}_e2e`;
  return url.toString();
}
