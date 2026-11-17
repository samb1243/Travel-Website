import { connection, type NextRequest } from "next/server";
import { searchPlaces } from "@/server/geocode";
import { rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

// Per-user limit on top of the global 1 req/s, so one account can't hog the queue.
const allowed = (userId: string) => rateLimit(`geocode:${userId}`, 30, 60_000);

/** GET /api/geocode?q=Lisbon (signed-in users only) */
export async function GET(request: NextRequest) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Log in to search places" }, { status: 401 });
  if (!allowed(user.id)) {
    return Response.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const places = await searchPlaces(q);
    return Response.json({ places });
  } catch {
    return Response.json(
      { error: "Place search isn't responding. Try again, or add the stop without a location." },
      { status: 502 },
    );
  }
}
