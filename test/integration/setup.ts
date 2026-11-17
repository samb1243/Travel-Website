// Runs before every integration test file. Points the app at the test database
// and replaces the Next.js request APIs that don't exist outside a request.

import { vi } from "vitest";
import { testDatabaseUrl } from "./test-database";

process.env.DATABASE_URL = testDatabaseUrl();

vi.mock("next/navigation", async () => {
  const { NotFoundError, RedirectError } = await import("./errors");
  return {
    notFound: () => {
      throw new NotFoundError();
    },
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

// The signed-in user is whoever the test says (see signInAs in helpers.ts).
vi.mock("@/server/session", async () => {
  const { RedirectError } = await import("./errors");
  const state = globalThis as unknown as { __testUser?: unknown };
  const getCurrentUser = async () => state.__testUser ?? null;
  return {
    getSession: async () => (state.__testUser ? { user: state.__testUser } : null),
    getCurrentUser,
    requireUser: async (returnTo?: string) => {
      const user = await getCurrentUser();
      if (!user) throw new RedirectError(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
      return user;
    },
  };
});
