import { connection } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";
import { saveUpload, UploadError } from "@/server/uploads";

/** POST /api/uploads (form field "file"): signed-in users only. Returns { url: "/img/<id>" }. */
export async function POST(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Log in to upload photos" }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 20, 60_000)) {
    return Response.json({ error: "Too many uploads. Wait a minute and try again." }, { status: 429 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Couldn't read that upload. Try again." }, { status: 400 });
  }
  if (!(file instanceof Blob)) return Response.json({ error: "Pick a photo to upload" }, { status: 400 });

  try {
    return Response.json(await saveUpload(user.id, file));
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
