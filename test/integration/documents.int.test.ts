// Tickets and documents: only the trip's planners can add or open them,
// only real PDFs and photos are kept, and they never leave the group.

import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as upload } from "@/app/api/documents/route";
import { GET as open } from "@/app/documents/[id]/route";
import { deleteDocument } from "@/server/actions/documents";
import { copyTrip } from "@/server/actions/sharing";
import { getSharedTrip } from "@/server/shared-trips";
import { getTripBuilderData } from "@/server/trips";
import type { CurrentUser } from "@/server/session";
import { MAX_DOCUMENTS_PER_ITEM } from "@/lib/documents";
import { RedirectError } from "./errors";
import { db, expectNotFound, makeTrip, makeUser, signInAs } from "./helpers";

let owner: CurrentUser;
let friend: CurrentUser;
let stranger: CurrentUser;
let f: Awaited<ReturnType<typeof makeTrip>>;

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");

async function add(itemId: string, body: Blob, name: string) {
  const form = new FormData();
  form.set("itemId", itemId);
  form.set("file", new File([body], name));
  const res = await upload(new Request("http://localhost/api/documents", { method: "POST", body: form }));
  return { status: res.status, json: (await res.json()) as { id?: string; name?: string; error?: string } };
}

const get = (id: string) => open(new Request(`http://localhost/documents/${id}`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  owner = await makeUser("Maya");
  friend = await makeUser("Ben");
  stranger = await makeUser("Stranger");
  f = await makeTrip(owner.id, "PUBLIC");
  await db.tripMember.create({ data: { tripId: f.trip.id, userId: friend.id } });
});

describe("adding documents", () => {
  it("keeps a PDF exactly as uploaded, for the trip's planners", async () => {
    signInAs(friend); // members can add them too
    const r = await add(f.item.id, new Blob([PDF]), "Boarding pass TG917.PDF");
    expect(r).toMatchObject({ status: 200, json: { name: "Boarding pass TG917.pdf" } });

    signInAs(owner);
    const res = await get(r.json.id!);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(PDF))).toBe(true);

    const data = await getTripBuilderData(f.trip.id, owner.id);
    expect(data!.stops[0].items[0].documents.map((d) => d.name)).toEqual(["Boarding pass TG917.pdf"]);
  });

  it("re-encodes photos without their camera data", async () => {
    const photo = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#ffffff" } })
      .jpeg()
      .withExif({ IFD0: { Make: "SecretCam" } })
      .toBuffer();
    signInAs(owner);
    const r = await add(f.item.id, new Blob([new Uint8Array(photo)]), "visa.jpg");
    expect(r.json.name).toBe("visa.webp");
    const res = await get(r.json.id!);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
  });

  it("refuses anything that isn't really a PDF or a photo, whatever it's called", async () => {
    signInAs(owner);
    for (const [body, name] of [
      ["<html><script>alert(1)</script></html>", "ticket.pdf"],
      ["<svg onload=alert(1)>", "ticket.png"],
      ["", "empty.pdf"],
    ]) {
      expect((await add(f.item.id, new Blob([body]), name)).status).toBe(400);
    }
    expect(await db.itemDocument.count({ where: { tripId: f.trip.id } })).toBe(0);
  });

  it("is only for the trip's planners, and limits files per booking", async () => {
    signInAs(stranger);
    expect((await add(f.item.id, new Blob([PDF]), "x.pdf")).status).toBe(404);
    signInAs(null);
    expect((await add(f.item.id, new Blob([PDF]), "x.pdf")).status).toBe(401);

    signInAs(owner);
    for (let i = 0; i < MAX_DOCUMENTS_PER_ITEM; i++) await add(f.item.id, new Blob([PDF]), `p${i}.pdf`);
    expect((await add(f.item.id, new Blob([PDF]), "one-too-many.pdf")).status).toBe(400);
  });
});

describe("opening documents", () => {
  it("gives everyone else the same 404, signed in or not", async () => {
    signInAs(owner);
    const { json } = await add(f.item.id, new Blob([PDF]), "visa.pdf");
    for (const who of [stranger, null]) {
      signInAs(who);
      expect((await get(json.id!)).status).toBe(404);
    }
    signInAs(owner);
    expect((await get("doesnotexist000000000000")).status).toBe(404);
    expect((await get("../../etc/passwd")).status).toBe(404);
  });

  it("never shows them on shared pages or copies them", async () => {
    signInAs(owner);
    const { json } = await add(f.item.id, new Blob([PDF]), "passport scan.pdf");

    signInAs(null);
    const shared = JSON.stringify(await getSharedTrip(f.trip.slug, null));
    expect(shared).not.toContain(json.id!);
    expect(shared).not.toContain("passport scan");

    signInAs(stranger);
    const err = await copyTrip(f.trip.id, { startDate: "" }).then(
      () => null,
      (e: unknown) => e,
    );
    const copyId = (err as RedirectError).url.match(/^\/trips\/([^?]+)/)![1];
    expect(await db.itemDocument.count({ where: { tripId: copyId } })).toBe(0);
  });
});

describe("removing documents", () => {
  it("is for the trip's planners only", async () => {
    signInAs(owner);
    const { json } = await add(f.item.id, new Blob([PDF]), "visa.pdf");
    signInAs(stranger);
    await expectNotFound(deleteDocument(json.id!));
    signInAs(friend);
    expect(await deleteDocument(json.id!)).toEqual({ ok: true });
    expect(await db.itemDocument.count({ where: { tripId: f.trip.id } })).toBe(0);
  });
});
