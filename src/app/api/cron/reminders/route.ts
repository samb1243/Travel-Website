import { connection } from "next/server";
import { runReminders } from "@/server/reminders";

/**
 * GET /api/cron/reminders: the daily reminder run. Vercel Cron calls it once a
 * day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". Anyone else
 * is refused. Locally, without CRON_SECRET set, it runs for anyone, so you can
 * trigger it by hand.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return new Response("CRON_SECRET is not set", { status: 503 });
  }
  const result = await runReminders();
  return Response.json(result);
}
