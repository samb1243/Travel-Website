import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { sendEmail } from "@/server/email";

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  appName: "TripStack",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // A reset logs out every other device.
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your TripStack password",
        text: `Hi ${user.name},\n\nReset your password here (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, ignore this email.`,
      });
    },
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},

  account: {
    // Google verifies email addresses, so signing in with Google using the same
    // email as an existing password account links the two.
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  user: {
    additionalFields: {
      // Changed only through our own validated profile action.
      homeCurrency: { type: "string", required: false, defaultValue: "EUR", input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days: travellers shouldn't get logged out mid-trip
    updateAge: 60 * 60 * 24,
    // No cookie cache: profile edits (name, avatar, currency) show up immediately,
    // and a revoked session stops working at once. Costs one indexed lookup.
  },

  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
