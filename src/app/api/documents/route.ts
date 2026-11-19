import { connection } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";
import { DocumentError, saveDocument } from "@/server/documents";

/**
 * POST /api/documents (form fields "itemId" and "file"): attach a ticket or
 * document to a booking. Only the trip's planners; anything else is a 404,
 * the same as a booking that doesn't exist.
 */
export async function POST(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Log in to add files" }, { status: 401 });
  if (!(await rateLimit(`document:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Too many uploads. Wait a minute and try again." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Couldn't read that upload. Try again." }, { status: 400 });
  }
  const itemId = form.get("itemId");
  const file = form.get("file");
  if (typeof itemId !== "string" || itemId.length > 40 || !(file instanceof Blob)) {
    return Response.json({ error: "Choose a file to add" }, { status: 400 });
  }

  try {
    const name = file instanceof File ? file.name : "";
    return Response.json(await saveDocument(user.id, itemId, file, name));
  } catch (e) {
    if (e instanceof DocumentError) {
      return e.message === "not-found"
        ? Response.json({ error: "Not found" }, { status: 404 })
        : Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
