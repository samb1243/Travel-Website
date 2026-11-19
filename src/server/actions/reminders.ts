"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { verifyUnsubscribe } from "@/server/unsubscribe";

/** Profile switch: reminder emails on or off, for yourself. */
export async function setEmailReminders(on: boolean): Promise<{ ok: true }> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { emailReminders: z.boolean().parse(on) } });
  revalidatePath("/profile");
  return { ok: true };
}

/** From the link in an email: no login needed, the link is signed for one account. */
export async function unsubscribeFromEmail(userId: string, token: string): Promise<{ ok: boolean }> {
  if (!verifyUnsubscribe(userId, token)) return { ok: false };
  await db.user.updateMany({ where: { id: userId }, data: { emailReminders: false } });
  return { ok: true };
}
