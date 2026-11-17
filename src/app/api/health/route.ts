import { connection } from "next/server";
import { db } from "@/lib/db";

// Simple check that the app can reach Postgres. Visit /api/health.
export async function GET() {
  await connection(); // always run at request time, never prerender
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, database: "up" });
  } catch {
    return Response.json({ ok: false, database: "down" }, { status: 503 });
  }
}
