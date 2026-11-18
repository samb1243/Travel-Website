import { connection, type NextRequest } from "next/server";
import { buildTripIcs } from "@/server/calendar";
import { getCurrentUser } from "@/server/session";

/**
 * GET /trips/<id>/calendar.ics: a one-off download of the trip for calendar
 * apps. Signed-in editors only; anyone else gets a 404 (no probing).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/trips/[id]/calendar.ics">) {
  await connection();
  const { id } = await params;
  const user = await getCurrentUser();
  const ics = user ? await buildTripIcs(id, user.id, request.nextUrl.origin) : null;
  if (!ics) return new Response("Not found", { status: 404 });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tripster-trip.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
