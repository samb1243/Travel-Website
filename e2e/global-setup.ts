import { execSync } from "node:child_process";
import pg from "pg";
import { e2eDatabaseUrl } from "./database";

/** Creates the browser-test database if needed, applies migrations, empties it and adds the demo data. */
export default async function globalSetup() {
  const url = new URL(e2eDatabaseUrl());
  const dbName = url.pathname.slice(1).split("?")[0];
  if (!/^[a-z0-9_]+_e2e$/.test(dbName)) {
    throw new Error(`Refusing to use "${dbName}" for browser tests: the database name must end in _e2e.`);
  }

  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (e) {
    throw new Error(`Can't reach Postgres for the browser tests. Is Docker running (npm run db:up)?\n${e}`);
  }
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });

  // Every table, emptied (including rate-limit counters and sessions from the last run)
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  await db.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
  await db.end();

  execSync("npx prisma db seed", { env, stdio: "pipe" });
}
