"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fieldErrors, profileSchema } from "@/lib/validation/auth";
import { requireUser } from "@/server/session";
import { isOwnUpload } from "@/server/uploads";
import { optionalImageUrl } from "@/lib/validation/common";
import { changedColors, cleanCustomColors } from "@/lib/colors";
import { Prisma } from "@/generated/prisma/client";

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
  // An uploaded photo has to be one you uploaded yourself
  if (parsed.data.image?.startsWith("/img/") && !(await isOwnUpload(user.id, parsed.data.image))) {
    return { ok: false, errors: { image: "Upload the photo again" } };
  }

  await db.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  revalidatePath("/", "layout"); // header avatar and name
  return { ok: true, message: "Profile saved" };
}

/** Saves someone's own colour coding (only colours that differ from the defaults). Null resets. */
export async function saveColors(colors: unknown): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const changed = colors === null ? {} : changedColors(cleanCustomColors(colors));
  await db.user.update({
    where: { id: user.id },
    data: { colors: Object.keys(changed).length ? changed : Prisma.DbNull },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Sets (or with "" removes) the profile photo straight away, so the avatar in
 * the header changes as soon as a photo is uploaded, without a separate save.
 */
export async function setProfilePhoto(image: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = optionalImageUrl.safeParse(image);
  if (!parsed.success) return { ok: false, message: "Use an https:// link to a picture, or upload one." };
  if (parsed.data?.startsWith("/img/") && !(await isOwnUpload(user.id, parsed.data))) {
    return { ok: false, message: "Upload the photo again." };
  }
  await db.user.update({ where: { id: user.id }, data: { image: parsed.data } });
  revalidatePath("/", "layout"); // header avatar
  return { ok: true };
}
