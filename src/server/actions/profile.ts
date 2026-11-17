"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fieldErrors, profileSchema } from "@/lib/validation/auth";
import { requireUser } from "@/server/session";

export type ProfileState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  // Server actions are public endpoints: always re-check who is calling.
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    image: formData.get("image") ?? "",
    homeCurrency: formData.get("homeCurrency"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await db.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  revalidatePath("/", "layout"); // header avatar and name
  return { ok: true, message: "Profile saved" };
}
