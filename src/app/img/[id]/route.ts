import { connection } from "next/server";
import { getUpload } from "@/server/uploads";

/**
 * GET /img/<id>: an uploaded photo. Ids are random and unlisted, like any
 * photo link; the trip pages decide who gets to see the link.
 */
export async function GET(_request: Request, ctx: RouteContext<"/img/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const upload = await getUpload(id);
  if (!upload) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(upload.bytes), {
    headers: {
      "Content-Type": upload.contentType,
      // Photos never change (a new upload gets a new id)
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
