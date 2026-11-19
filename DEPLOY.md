# Putting Tripster online (Vercel + Neon)

Step by step, from nothing to a live site. About an hour, most of it waiting
for DNS. You'll create accounts with five services; each has a free tier
that's enough to start. Check each one's current limits and terms before
relying on them (for example, Vercel's free Hobby plan is for non-commercial
use; a business needs the Pro plan).

| Service | What for | Needed? |
| ------- | -------- | ------- |
| [Neon](https://neon.tech) | The Postgres database (with backups) | Yes |
| [Vercel](https://vercel.com) | Runs the app; deploys on every push to GitHub | Yes |
| [Resend](https://resend.com) | Sends password-reset emails | Strongly recommended |
| [MapTiler](https://www.maptiler.com) | Map tiles for the trip maps | Strongly recommended |
| A domain | e.g. `tripster.example.com` (you can start on `*.vercel.app`) | Optional at first |
| Google Cloud | "Continue with Google" | Optional |
| [Anthropic](https://console.anthropic.com) | Reading booking emails with Claude | Optional |

Keep the values you collect in a password manager, not in a file in the repo.

---

## 1. Database: Neon

1. Sign up at [neon.tech](https://neon.tech) and **create a project**. Pick the region
   closest to most of your users (and use the same region for Vercel's functions later).
2. On the project dashboard, open **Connect**. Copy two connection strings:
   - **Pooled** (the host contains `-pooler`): this is `DATABASE_URL`.
   - **Direct** (turn "Connection pooling" off): this is `DIRECT_URL`. Migrations use it.
   Both end in `?sslmode=require`; keep that.
3. Backups: Neon keeps a restore window (point-in-time restore) on every plan; check how long
   yours is under **Settings → Storage / History retention**.

Nothing else to do: the tables are created by the first deploy.

## 2. Secrets you generate yourself

In PowerShell:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

That's `BETTER_AUTH_SECRET`. Use a new one for the live site (never the one in your `.env`),
and don't change it later: changing it signs everybody out.

## 3. App: Vercel

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, and import `samb1243/Travel-Website`.
3. Framework preset: **Next.js** (detected). Leave the build settings alone: Vercel runs the
   `vercel-build` script, which applies database migrations (`prisma migrate deploy`) and
   then builds.
4. Under **Environment Variables**, add these for **Production**:

   | Name | Value |
   | ---- | ----- |
   | `DATABASE_URL` | Neon pooled string |
   | `DIRECT_URL` | Neon direct string |
   | `BETTER_AUTH_SECRET` | from step 2 |
   | `BETTER_AUTH_URL` | `https://<project>.vercel.app` for now (no trailing slash) |
   | `NOMINATIM_USER_AGENT` | `Tripster (https://<project>.vercel.app)`, or your contact email |
   | `RESEND_API_KEY`, `EMAIL_FROM` | from step 4 (add them when you have them) |
   | `NEXT_PUBLIC_MAPTILER_KEY` | from step 5 |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, step 7 |
   | `ANTHROPIC_API_KEY` | optional |

   You won't know the exact `*.vercel.app` address until the project exists. Enter your best
   guess, deploy, then correct it under **Settings → Environment Variables** and redeploy.
5. **Deploy.** The first build creates every table in Neon.
6. Under **Settings → Functions**, set the region to match Neon's.

If a setting is missing or wrong, the site refuses to start and the **Logs** tab says which one
("Tripster can't start; fix these settings"). Optional services that aren't set up show as
`[settings]` warnings in the logs instead.

**Preview deployments** (one per branch or pull request) get their own addresses. They share
the Production database only if you give them its settings, which isn't recommended. Sign-in
only works on the address in `BETTER_AUTH_URL`, so previews are for looking, not logging in.

## 4. Email: Resend

1. Sign up at [resend.com](https://resend.com), then **Domains → Add domain**. Use your own
   domain (or a subdomain like `mail.your-domain`).
2. Add the DNS records Resend shows (SPF and DKIM) at your domain's DNS provider and wait for
   **Verified**.
3. **API Keys → Create**, with **Sending access** only. That's `RESEND_API_KEY`.
4. `EMAIL_FROM` is the sender, on the verified domain: `Tripster <hello@your-domain>`.
5. Add both in Vercel and redeploy.

Without a domain yet, password reset emails can't be sent. Everything else works.

## 5. Maps: MapTiler

1. Sign up at [maptiler.com](https://www.maptiler.com), then **Account → API keys**.
2. Use the default key or create one, and under **Allowed HTTP origins** add your site
   (`<project>.vercel.app`, and your domain later). The key is visible in the page by design;
   this is what stops other sites using it.
3. Set it as `NEXT_PUBLIC_MAPTILER_KEY` in Vercel and **redeploy** (the key is built into the
   page, so it needs a new build).

## 6. Your own domain

1. Vercel: **Settings → Domains → Add**, and follow the DNS instructions.
2. Change `BETTER_AUTH_URL` to `https://your-domain` and `NOMINATIM_USER_AGENT` to match,
   then redeploy.
3. Add the domain to MapTiler's allowed origins and, if you use Google sign-in, its
   redirect address (next step).

## 7. Optional: Google sign-in

As in the README's "Google login" section, but with the live address: the authorized redirect
URI is `https://your-domain/api/auth/callback/google`. Set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in Vercel and redeploy.

## 8. Check it works

On the live site:

- [ ] Sign up, log out, log in.
- [ ] **Forgot password**: the email arrives (check spam the first time) and the link works.
- [ ] Create a trip, add a stop with place search, add a booking.
- [ ] The Map tab shows MapTiler's map, with its credit in the corner.
- [ ] Upload a photo (cover or booking).
- [ ] Make the trip public: it opens logged out at `/t/...` and appears in Explore for others.
- [ ] Calendar: subscribe to the trip in Google Calendar (works now that the site is online).
- [ ] On your phone: Add to Home Screen, open a trip, turn on flight mode, open it again.
- [ ] Vercel **Logs**: no `[settings]` warnings you didn't expect.

## Good to know

- **Updating:** push to `main` and Vercel deploys it, running any new migrations first.
- **Demo data never goes live:** `npm run db:seed` refuses to run in production, and the demo
  accounts don't exist there.
- **Rate limits** (log-in, uploads, searches, AI reads) are kept in the database, so they hold
  across all of Vercel's server instances. No Redis needed.
- **Place search** uses OpenStreetMap's free Nominatim service, limited to one search per
  second for the whole site. Fine while small; for heavy use, switch to a paid geocoder
  behind `src/server/geocode.ts`.
- **Photos** are stored in the database. Fine to start; with many users, move them to file
  storage (Vercel Blob, Cloudflare R2) behind the same `/img/<id>` route.
- **Request size:** Vercel accepts up to 4.5 MB per request, so big photos are shrunk in the
  browser before upload and very long emails are refused with a message.
