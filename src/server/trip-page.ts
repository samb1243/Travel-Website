import "server-only";
import { notFound } from "next/navigation";
import { requireTripEditor } from "@/server/permissions";
import { getTripForEditor } from "@/server/trips";

/**
 * Shared loader for /trips/[id]/* pages: checks access, then loads the trip.
 * Both calls are cached per request, so layout + page cost one lookup each.
 */
export async function loadEditorTrip(params: Promise<{ id: string }>, subpath = "") {
  const { id } = await params;
  const user = await requireTripEditor(id, `/trips/${id}${subpath}`);
  const trip = await getTripForEditor(id, user.id);
  if (!trip) notFound();
  return { user, trip };
}
