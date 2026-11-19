import "server-only";
import { Resend } from "resend";

type Email = {
  to: string;
  subject: string;
  text: string;
  /** e.g. List-Unsubscribe, so mail apps show their own "unsubscribe" button */
  headers?: Record<string, string>;
};

// Emails (password resets) go out through Resend when RESEND_API_KEY and
// EMAIL_FROM are set. Without them, in development, they're printed to the
// terminal running `npm run dev` instead.

let client: Resend | null = null;

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Sends an email. Never throws: a failed send is logged, not shown, so the
 * "forgot password" form can't reveal which addresses have accounts.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (emailConfigured()) {
    client ??= new Resend(process.env.RESEND_API_KEY);
    try {
      const { error } = await client.emails.send({
        from: process.env.EMAIL_FROM!, // e.g. "Tripster <hello@yourdomain.com>"
        to: email.to,
        subject: email.subject,
        text: email.text,
        headers: email.headers,
      });
      if (error) console.error(`[email] Resend refused "${email.subject}": ${error.message}`);
    } catch (e) {
      console.error(`[email] Couldn't reach Resend for "${email.subject}":`, e instanceof Error ? e.message : e);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    console.error(`[email] RESEND_API_KEY / EMAIL_FROM not set; dropped "${email.subject}"`);
    return;
  }
  console.log(
    [
      "",
      "┌─ 📧 Email (dev only, not actually sent) ─────────────",
      `│ To:      ${email.to}`,
      `│ Subject: ${email.subject}`,
      "│",
      ...email.text.split("\n").map((line) => `│ ${line}`),
      "└──────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}
