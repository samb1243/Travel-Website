# Go-live checklist (for later)

Your to-do list for putting Tripster online. The code side is done; these steps need your own
accounts. Full instructions for each are in [DEPLOY.md](DEPLOY.md) (step numbers below match).
Keep every key and password in a password manager, never in a file in the repo.

## Accounts and settings

- [ ] **Neon** (database), step 1: create a project in the region nearest your users; copy the
      pooled connection string (`DATABASE_URL`) and the direct one (`DIRECT_URL`).
- [ ] **Secret**, step 2: generate a new `BETTER_AUTH_SECRET` for the live site (PowerShell
      command in DEPLOY.md). Never reuse the local one; never change it later.
      Make a second one the same way for `CRON_SECRET` (daily reminder emails).
- [ ] **Vercel** (app), step 3: sign in with GitHub, import `samb1243/Travel-Website`, add the
      settings for Production, deploy. Then fix `BETTER_AUTH_URL` to the real
      `https://….vercel.app` address and redeploy. Set the functions region to match Neon's.
- [ ] **Resend** (email), step 4: add and verify your domain (DNS records), create a
      sending-only API key; set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel, redeploy.
- [ ] **MapTiler** (maps), step 5: create a key, restrict it to your site's address; set
      `NEXT_PUBLIC_MAPTILER_KEY` in Vercel, redeploy.
- [ ] **`NOMINATIM_USER_AGENT`**: `Tripster (https://your-site)` or a contact email.
- [ ] **Own domain** (optional), step 6: add it in Vercel; update `BETTER_AUTH_URL`,
      `NOMINATIM_USER_AGENT`, MapTiler's allowed origins (and Google's redirect address).
- [ ] **Google sign-in** (optional), step 7: redirect URI
      `https://your-site/api/auth/callback/google`; set both Google settings.
- [ ] **Claude email reading** (optional): set `ANTHROPIC_API_KEY`.
- [ ] Check each service's free-tier limits and terms (Vercel's free plan is non-commercial).

## Check the live site (step 8)

- [ ] Sign up, log out, log in.
- [ ] Forgot password: the email arrives and the link works.
- [ ] Vercel **Settings → Cron Jobs → Run** on the reminders job: the result shows in Logs,
      and a trip starting tomorrow gets its "starts tomorrow" email.
- [ ] Create a trip, find a stop with place search, add a booking.
- [ ] Map tab shows MapTiler's map with its credit.
- [ ] Upload a photo.
- [ ] Make a trip public: opens logged out at `/t/…`, appears in Explore for others.
- [ ] Subscribe to a trip's calendar in Google Calendar.
- [ ] Phone: Add to Home Screen, open a trip, flight mode on, open it again.
- [ ] Vercel Logs: no unexpected `[settings]` warnings.

## Later

- [ ] Check the name "Tripster" isn't taken where you launch.
- [ ] Forwarding address for booking emails (needs an inbound email service, e.g. Postmark).
- [ ] With many users: move photos to file storage (Vercel Blob or Cloudflare R2), and place
      search to a paid geocoder.
