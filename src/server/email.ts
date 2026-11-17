import "server-only";

type Email = { to: string; subject: string; text: string };

/**
 * There's no email provider yet. In development, emails are printed to the
 * terminal running `npm run dev`. Plug a provider (Resend, Postmark, SES) in
 * here before deploying, otherwise password reset links can't be delivered.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error(`[email] No email provider configured; dropped "${email.subject}"`);
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
