"use server";

import { z } from "zod";
import { requireStopEditor } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";
import { getStopIdeas, type StopIdeas } from "@/server/recommendations";

/** Ideas from other travellers for one of your stops (read-only; nothing is saved). */
export async function loadStopIdeas(stopId: string): Promise<({ ok: true } & StopIdeas) | { ok: false; message: string }> {
  const id = z.string().min(1).max(40).parse(stopId);
  const { user } = await requireStopEditor(id);
  if (!rateLimit(`ideas:${user.id}`, 60, 60_000)) return { ok: false, message: "Too many requests. Wait a minute and try again." };
  const result = await getStopIdeas(id, user.id);
  if (!result) return { ok: false, message: "That stop no longer exists." };
  return { ok: true, ...result };
}
