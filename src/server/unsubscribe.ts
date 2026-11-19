import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed "stop reminder emails" links: anyone with the link from their own
// email can switch reminders off with one click, without logging in, and
// nobody can make a link for someone else's account.

const secret = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return `${s}:unsubscribe`;
};

export const unsubscribeToken = (userId: string) => createHmac("sha256", secret()).update(userId).digest("base64url");

export function verifyUnsubscribe(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || userId.length > 40 || token.length > 100) return false;
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const siteUrl = () => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function unsubscribeUrls(userId: string) {
  const q = `u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
  return { page: `${siteUrl()}/unsubscribe?${q}`, oneClick: `${siteUrl()}/api/unsubscribe?${q}` };
}
