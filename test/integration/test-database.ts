import "dotenv/config";

/**
 * The integration tests use their own database next to the dev one
 * (tripstack → tripstack_test), so they never touch your data.
 * Override with TEST_DATABASE_URL.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const dev = process.env.DATABASE_URL;
  if (!dev) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const url = new URL(dev);
  url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  return url.toString();
}
