import { execSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./test-database";

/** Creates the test database if needed, applies migrations, and empties it. */
export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const dbName = url.pathname.slice(1).split("?")[0];
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Refusing to use "${dbName}" for tests: the database name must end in _test.`);
  }

  // Connect to the server's default database to create ours.
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (e) {
    throw new Error(`Can't reach Postgres for the integration tests. Is Docker running (npm run db:up)?\n${e}`);
  }
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });

  // Start from empty tables every run.
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(
    `TRUNCATE "ItemLink", "Item", "Stop", "SavedTrip", "Trip", "Session", "Account", "Verification", "User" CASCADE`,
  );
  await db.end();
}
