import { connection, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribe } from "@/server/unsubscribe";

/**
 * POST /api/unsubscribe?u=…&t=… : one-click unsubscribe (RFC 8058), used by
 * mail apps' own "unsubscribe" buttons. The link is signed for one account.
 */
export async function POST(request: NextRequest) {
  await connection();
  const u = request.nextUrl.searchParams.get("u");
  const t = request.nextUrl.searchParams.get("t");
  if (!verifyUnsubscribe(u, t)) return new Response("Invalid link", { status: 400 });
  await db.user.updateMany({ where: { id: u }, data: { emailReminders: false } });
  return new Response("Reminder emails are off.", { status: 200 });
}
