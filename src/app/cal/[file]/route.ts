import { connection, type NextRequest } from "next/server";
import { calendarForFeed } from "@/server/calendar";
import { rateLimit } from "@/server/rate-limit";

/**
 * GET /cal/<token>.ics: a private calendar feed that Google/Apple/Outlook
 * Calendar can subscribe to. Calendar apps can't log in, so the unguessable
 * token is the key; it stops working when reset, turned off, or when its owner
 * leaves or is removed from the trip.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/cal/[file]">) {
  await connection();
  const { file } = await params;
  const token = file.replace(/\.ics$/, "");
  // Calendar apps poll every few hours; this only stops hammering.
  if (!(await rateLimit(`cal:${token}`, 30, 60_000))) return new Response("Too many requests", { status: 429 });

  const feed = await calendarForFeed(token, request.nextUrl.origin);
  if (!feed) return new Response("Not found", { status: 404 });

  return new Response(feed.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${feed.slug}.ics"`,
      "Cache-Control": "private, no-store",
      // Keep the private link out of other sites' logs and search engines
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
