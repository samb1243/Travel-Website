import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * The single place that reads the session (Data Access Layer).
 * Cached per request, so calling it from several components costs one lookup.
 * Reads request headers: call it inside a <Suspense> boundary.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  homeCurrency: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const { id, name, email, image, homeCurrency } = session.user;
  return { id, name, email, image: image ?? null, homeCurrency: homeCurrency ?? "EUR" };
}

/** For pages and actions that need a signed-in user. Redirects to /login otherwise. */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}
