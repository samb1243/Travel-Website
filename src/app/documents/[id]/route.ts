import { connection } from "next/server";
import { getCurrentUser } from "@/server/session";
import { getDocumentFor } from "@/server/documents";

/**
 * GET /documents/<id>: a booking's ticket or document, for the trip's
 * planners only. Anyone else (or a wrong id) gets the same 404.
 */
export async function GET(_request: Request, ctx: RouteContext<"/documents/[id]">) {
  await connection();
  const user = await getCurrentUser();
  const { id } = await ctx.params;
  const doc = user ? await getDocumentFor(user.id, id) : null;
  if (!doc) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const pdf = doc.contentType === "application/pdf";
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.contentType,
      // Opens in the browser's own viewer; the name is used when saving it
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      // Personal: never kept by shared caches (the offline copy is the app's own)
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(pdf ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
