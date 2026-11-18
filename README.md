# Tripster

Plan and share trips: backpacking routes, multi-city trips and hikes. Keep the route, bookings,
links and budget in one place, then publish a trip so others can copy it.

- **Plan:** stops in route order (drag to reorder), flights, stays, transport, activities, gear,
  booking links, confirmation numbers and costs.
- **Use it on the road:** day-by-day itinerary, a checklist of what's still to book, a map of the
  route and a budget, all mobile-first with big tap targets and light/dark mode.
- **Share:** make a trip unlisted or public; anyone can view it read-only and copy it into
  their own account, minus your personal details.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 + shadcn/ui ·
PostgreSQL 17 (Docker) + Prisma 7 · Better Auth · Zod · dnd-kit · Leaflet + OpenStreetMap ·
Vitest.

The app's public name lives in `src/lib/brand.ts`; the logo is `src/components/logo-mark.tsx` and
`src/app/icon.svg`. Folder, package and database names stay `tripstack` (internal only).

## Requirements (Windows)

- **Node.js 22 or newer** (`node --version`)
- **Docker Desktop**, running
- **VS Code** (recommended extensions: Prisma, Tailwind CSS IntelliSense, ESLint)

Keep the project **outside OneDrive** (for example `C:\dev\tripstack`). OneDrive syncing
`node_modules` and `.next` causes file-lock (`EPERM`) errors.

## First-time setup (PowerShell)

```powershell
cd C:\dev\tripstack
npm install
Copy-Item .env.example .env
# put a random value in BETTER_AUTH_SECRET (see the comment in .env)
npm run db:up
npx prisma migrate deploy
npm run db:seed
```

- `npm install` also runs `prisma generate`.
- `npm run db:up` starts Postgres in Docker on `localhost:5432` and waits until it's ready.
- `npx prisma migrate deploy` creates the tables.
- `npm run db:seed` loads the example trips below.

## Run the app

```powershell
npm run dev
```

Open http://localhost:3000. To check the database connection, open
http://localhost:3000/api/health; it should return `{"ok":true,"database":"up"}`.

## Example data

`npm run db:seed` creates three demo users and four trips. You can run it again at any time:
it deletes and recreates the demo users' trips and leaves everything else alone. It refuses to
run when `NODE_ENV=production`, because the demo password is published here.

| Trip                                       | Owner                | Visibility | Shows off                                     |
| ------------------------------------------ | -------------------- | ---------- | --------------------------------------------- |
| Three weeks in Thailand, Laos & Vietnam    | maya@example.com     | public     | overland transport, visas, mixed statuses     |
| Two weeks by train: Amsterdam to Budapest  | lukas@example.com    | public     | rail pass, 2 travellers, 5 countries          |
| Tour du Mont Blanc: 8 stages, 3 countries  | sophie@example.com   | public     | hut-to-hut hiking stages, gear, cash-only huts|
| Japan in cherry blossom season (draft)     | maya@example.com     | **private**| must never appear in Explore or share links   |

Some items contain confirmation codes, private notes and "confirmation" links. These are
personal and never appear on shared pages or in copies.

**Demo logins:** each demo user above can log in with the password `tripstack-demo`.

## Useful scripts

| Command                    | What it does                                                    |
| -------------------------- | --------------------------------------------------------------- |
| `npm run dev`              | Start the dev server                                            |
| `npm run build`            | Production build (stop `npm run dev` first)                     |
| `npm run lint`             | ESLint                                                          |
| `npm run typecheck`        | TypeScript check                                                |
| `npm test`                 | Unit tests (fast, no database needed)                           |
| `npm run test:integration` | Permission, privacy and validation tests against a test database |
| `npm run test:all`         | Both                                                            |
| `npm run db:up`            | Start Postgres (Docker)                                         |
| `npm run db:down`          | Stop Postgres (data is kept in a Docker volume)                 |
| `npm run db:migrate`       | Create and apply a migration after schema edits                 |
| `npm run db:seed`          | Load example trips                                              |
| `npm run db:reset`         | Wipe the database and re-apply migrations (then run `db:seed`)  |
| `npm run db:studio`        | Browse the database in Prisma Studio                            |

## Accounts and login

- **Email + password** works out of the box. Passwords need 8–128 characters.
- **Forgot password:** there's no email service yet, so in development the reset email
  (with its link) is **printed in the terminal running `npm run dev`**. Copy the link into
  the browser. Links are valid for 1 hour and work once. Resetting logs out all devices.
- Sessions last 30 days, so you stay logged in while travelling.
- `/dashboard`, `/profile` and `/trips/*` need a login. Everything is checked on the
  server; `src/proxy.ts` only does a fast "no cookie at all → go to login" redirect.

### Google login (optional)

The "Continue with Google" button only appears when both Google variables are set.

1. Go to https://console.cloud.google.com → create a project → **APIs & Services → OAuth
   consent screen** (External, add yourself as a test user).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Authorised JavaScript origin: `http://localhost:3000`
   Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then restart `npm run dev`.

Signing in with Google using the same email as an existing password account links the two.

## Trips

- **My trips** (`/dashboard`) lists your trips as photo cards, split into Upcoming and Past,
  plus trips you saved from Explore.
- **Booking progress** ("22/34 booked") counts items that need a booking. Booked and
  pay-on-arrival items count as booked; "No booking needed" items are left out.
- **Trip types:** pick all that fit, up to 4, from Backpacking, Multi-city, City break,
  Road trip, Rail journey, Hiking, Cycling, Beach & islands, Snow & skiing, Wildlife &
  safari, Family trip and Other. Explore's type filter finds a trip under any of its types.
- **New trip** needs only a name and at least one type. Dates, budget, travellers, currency (defaults to
  your home currency), description and cover photo link are optional.
- **Edit / delete** from the pencil button on a trip. Deleting asks for confirmation.
- Only the owner can open `/trips/<id>/…`. Anyone else gets "Page not found", the same as
  for a trip that doesn't exist, so private trips can't be discovered.

### Overview: building the route

- **Add a stop**: search for a place (OpenStreetMap), pick it, set arrive/leave dates. The
  arrive date defaults to when the previous stop ends. No internet? "Add without a location".
- **Reorder**: drag the ⋮⋮ handle, or use the stop's ⋯ menu → Move up / Move down.
- **Delete a stop**: choose whether its bookings are deleted too or kept under "Whole trip".
- **Add to a stop**: flight, stay, bus/train, activity, food, gear or other. Fields adapt to
  the type (flights and transport get From/To; leave the name empty to get "A → B").
- **Links** become one-tap buttons on the card. "Confirmation" links, confirmation numbers
  and private notes are marked "Just for you": never shown on shared trips or copied.
- Tap a card to edit it, move it to another stop, or delete it.
- Times are local wall-clock times where the thing happens; they never shift with your
  phone's time zone.

### Itinerary

- One card per day of the trip, with where you are ("Tokyo → Kyoto" on travel days) and
  what's happening, in time order.
- Stays, flights and buses/trains that end on another day show up twice: Check-in / Departs
  on the first day, Check-out / Arrives on the last.
- The bottom of each day says where you sleep that night (a stay, or an overnight journey),
  or "No place to stay added for tonight".
- Confirmation numbers (tap to copy) and links are right there, for use on the road.
- The day strip at the top jumps to any day. During a trip the page opens on today.
- Things without a date are listed under "Not scheduled yet"; tap one to give it a date.
- Dated things outside the trip dates (e.g. "buy a rain jacket") get their own day card.

### Checklist

- Every booking grouped as To book → Pay on arrival → Booked → No booking needed, each
  sorted by date (an item without its own date uses its stop's arrival date).
- Tap the circle to mark something booked (tap again to undo it). The toast has an Undo button.
- Tap the status pill to pick any of the four statuses, or tap the name to edit the item.
- To-book items within 14 days are highlighted amber ("Book now · in 5 days"), ones within
  45 days get a "Coming up" tag, and ones whose date has passed are highlighted red.
- A to-book item with a "Booking" link shows it as a button, so you can book in one tap.

### Map

- Numbered pins for each stop, joined by a dashed line in route order, on OpenStreetMap
  (via [Leaflet](https://leafletjs.com)).
- Tap a stop in the list to fly to it; tap a pin to highlight its row. The arrow button opens
  the stop in Google Maps (or your phone's maps app) for directions.
- Shows the rough route length ("about 2,226 km stop to stop, as the crow flies").
- Stops without a location are listed with a dashed number and a link to add one.
- Routes across the Pacific (e.g. Tokyo → Honolulu) take the short way over the 180° line.

### Budget

- One currency per trip (set when you create or edit it). All sums are done in whole cents,
  so totals never drift.
- Planned spend against your budget, with a bar that turns amber at 90% and red when over,
  plus what's left (or how much you're over).
- Per person, per day, and per person per day. Costs are totals for the whole group, so
  "per person" divides by the trip's number of travellers.
- "How much is sorted": spend split by booking status, with a warning for money tied up in
  things not booked yet (their prices may change).
- By category and by stop (route order, plus "Whole trip"). Per-night figures use only the
  stop's stays, so a flight filed under a stop doesn't inflate them.
- The 5 biggest costs; tap one to edit it. Items without a price are counted and mentioned,
  but not included in totals.

### Place search

Goes through `/api/geocode` (logged-in users only). It follows OpenStreetMap's usage policy:
searches run on submit (not while typing), at most one request per second for the whole app,
results cached for a day, and 30 searches per user per minute. Set `NOMINATIM_USER_AGENT` in
`.env` to identify your deployment before going live.

## Sharing, Explore and copying

- **Share** (button on a trip's cover) sets who can see it:
  - **Private**: only you. Anyone else opening its link gets "Trip not found", exactly as if it
    didn't exist.
  - **Unlisted**: anyone with the link (`/t/<slug>`) can view it. Not on Explore, and search
    engines are asked not to index it.
  - **Public**: also listed on Explore.
- **Shared pages** (`/t/<slug>`) are read-only, need no account, and show Route, Days, Map and
  Budget. As the owner you see a preview banner and a link back to editing.
- **Never shared or copied:** confirmation numbers, private notes ("Just for you") and
  "Confirmation" links. Shared notes, costs, booking/map/info links and stop notes *are*
  visible to anyone who can see the trip.
- **Explore** (`/explore`) lists public trips, newest first, with filters for type, length,
  budget per person and country. Filters live in the URL, so a filtered view can be shared.
  Budgets are compared using rough built-in exchange rates (`src/lib/fx.ts`), only for
  filtering; trips always show their own currency.
- **Save** keeps someone's trip under "Saved from Explore" on My trips. If its owner makes it
  private, it disappears from your list.
- **Copy this trip** (log in first) makes your own private copy: every stop, booking idea,
  cost and link, with every status reset to **To book**, personal details left behind, and
  "Based on X's trip" credited. Pick a new start date and every date moves to match. On
  your own trip the button says **Duplicate**.

## Calendar and print

**Export** (button on a trip) has both:

- **Keep it in your calendar:** "Make my calendar link" gives you a private link
  (`/cal/<code>.ics`) that Google, Apple or Outlook Calendar subscribe to and re-check every
  few hours. Bookings appear in local time (a 07:40 departure in Bangkok shows as 07:40,
  wherever you are), stops as all-day events. Each person on a trip has their own link;
  "Reset link" or "Stop syncing" turns it off, and it also stops when someone leaves or is
  removed from the trip. Google Calendar can only subscribe once the app is online (it can't
  reach `localhost`); Apple Calendar on the same computer, and downloads, work locally.
- **Download a calendar file (.ics):** a one-off snapshot to import.
- Calendar exports include confirmation numbers but never private notes (calendar services
  keep a copy).
- **Print or save as PDF** (`/trips/<id>/print`): a clean day-by-day itinerary with the route,
  stays, times, confirmation numbers, private notes, what's still to book and the budget.
  "Hide private details" removes confirmation numbers, private notes and confirmation links
  before you print a copy for someone else. Use your browser's Print and choose
  "Save as PDF".

## Planning together

- **People** (button on a trip) shows everyone planning it. The owner makes an **invite link**
  there and sends it however they like; it works for 14 days, and "New link" or "Turn off"
  stops the old one working. Anyone who opens it, logs in and taps **Join trip** becomes a
  member (up to 20 people per trip).
- **Members can:** add, edit, reorder and delete stops and bookings, change booking statuses,
  edit the trip's details, and see the group's confirmation numbers and private notes.
- **Only the owner can:** delete the trip, change who can see it (Private / Unlisted / Public),
  make or turn off invite links, and remove people. Members can **leave** from the People
  panel.
- Shared trips show on members' My trips as "Shared by …"; the owner's card says
  "Planning with 2 others". Removing or leaving takes access away immediately.
- On a trip with more than one person, each booking says who added it ("Added by Lukas",
  "Added by you") on the Overview and Checklist. Not shown on trips you plan alone, and never
  on public or unlisted pages.
- Confirmation numbers and private notes are visible to the group, but still never shown on
  public/unlisted pages or copied.

## Security

How the three rules ("validate inputs", "users can only edit their own trips", "never expose
private trips") are enforced, and where.

**Permissions: users can only edit their own trips**
- Every server action is a public HTTP endpoint, so each one checks the caller itself before
  touching data, whatever the UI sends (`src/server/actions/*`). There are 14, and nothing else
  is exported from those files (anything exported from a `"use server"` file becomes callable).
- Access checks live in one place, `src/server/permissions.ts`: `requireTripEditor`,
  `requireStopEditor` and `requireItemEditor` allow the owner and members; `requireTripOwner`
  guards delete, visibility, invites and removing people. Stops and items are looked up
  *through* their trip's editors, so passing your own trip id with someone else's item id
  doesn't work.
- Someone else's trip and a trip that doesn't exist get the same "not found", so ids can't be
  probed. Signed-out callers are sent to the login page.
- Public means "anyone can view and copy", never "anyone can edit".

**Privacy: never expose private trips or personal details**
- Shared pages, Explore, saved trips and copying all go through `src/server/shared-trips.ts`.
  Its queries use an explicit list of fields: confirmation numbers, private notes,
  confirmation links and the owner's email are never loaded. Every item is then stripped
  again (`stripPersonal` in `src/lib/sharing.ts`) as a second layer.
- Explore only ever queries `visibility = PUBLIC`. Page titles and link previews for a
  private trip say "Trip not found" to everyone but its owner.

**Input validation**
- Every action validates with Zod (`src/lib/validation/*`): lengths, enums, real calendar
  dates, money, coordinates, OpenStreetMap place ids, and links (`http(s)` only, so no
  `javascript:` or `data:` links). Invalid Explore filters in the URL are ignored.
- Sign-up and Google sign-in bypass our forms, so user names and avatars are cleaned again in
  Better Auth's database hooks; Better Auth's generic "update user" endpoint is switched off.
- Caps per account: 200 trips, 100 stops and 500 items per trip, 10 links per item. Creating
  or copying trips is limited to 20 a minute, place search to 30 a minute.

**Other protections**
- Passwords are hashed by Better Auth (scrypt); sessions are HTTP-only cookies. Sign-in
  redirects only go to paths on this site (`src/lib/safe-redirect.ts`).
- Security headers on every page (`next.config.ts`): no framing by other sites, no MIME
  sniffing, a strict referrer policy, camera/microphone/location off, HSTS on HTTPS.
- External links open with `rel="noopener noreferrer"`. React escapes all text, and stop
  names on the map are set as plain text (Leaflet's own APIs would treat them as HTML).

**Tested:** `npm run test:integration` runs the real server actions against a separate
`tripstack_test` database. It checks every write action as another user and as a signed-out
visitor on both private and public trips, confirming nothing in the database changes, and
covers invite links, what members can and can't do, and removing or leaving. It
also checks that shared pages, Explore, saved trips and copies never contain planted
secrets, and that malicious inputs are rejected. See `test/integration/`.

**Dependencies:** `npm audit --omit=dev` reports advisories in `picomatch`/`minimatch` (a
slowdown attack via file-pattern strings). They come only from Vitest (listed by Better Auth
as an optional test peer) and are not used by the running app, which never passes user input
to them. The advisory has no fixed version yet; re-check with `npm audit` from time to time.

## Testing

```powershell
npm test                    # unit tests, no database needed
npm run db:up               # integration tests need Postgres running
npm run test:integration    # creates and migrates tripstack_test automatically
```

The integration tests never touch your dev data: they use a `tripstack_test` database next to
the dev one (override with `TEST_DATABASE_URL`) and empty it at the start of each run. The
database name must end in `_test` or the tests refuse to start.

## Before going live

- [ ] Set a long random `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` / `APP_URL` to the real
      `https://` address. Better Auth sets secure cookies and turns on its built-in
      rate limiting for login and sign-up in production.
- [ ] Use a managed Postgres with backups; run `npx prisma migrate deploy` on each deploy.
      Never run `npm run db:seed` there.
- [ ] Send real emails for password resets (replace the console sender in
      `src/server/email.ts` with Resend, Postmark, SES…).
- [ ] Switch map tiles to a hosted provider: the free OpenStreetMap tile servers don't allow
      heavy app traffic ([tile policy](https://operations.osmfoundation.org/policies/tiles/)).
      Change `TILE_URL` in `src/components/map/route-map.tsx` and keep the attribution.
- [ ] Set `NOMINATIM_USER_AGENT` (or move to a hosted geocoder) for place search.
- [ ] The rate limits are kept in memory per server. With several instances or serverless,
      move `src/server/rate-limit.ts` to Redis/Upstash.
- [ ] Consider a full Content-Security-Policy with per-request nonces (generated in
      `src/proxy.ts`) to also restrict scripts; the current headers don't cover scripts.
- [ ] Cover photos and avatars are images from addresses users paste, so viewers' browsers
      load them from those sites. Consider re-hosting uploads (Phase 2) if that matters.
- [ ] Check the name "Tripster" isn't taken where you launch; other travel businesses use it.

## Phase 2 (planned, not built)

The code leaves room for each of these:

- **Recommendations:** stops store a stable OpenStreetMap place id (`Stop.placeId`) so trips
  through the same place can be matched; add a recommendations service behind a small
  interface, like place search in `src/server/geocode.ts`.
- **Multi-currency:** `Item.currency` is already in the schema (null = trip currency); replace
  the rough rates in `src/lib/fx.ts` with live ones and convert in the budget maths.
- **Parse booking emails** into items (forwarding address + parser), and a **PWA with
  offline access** for the itinerary and confirmation numbers.

## Troubleshooting

- **`failed to connect to the docker API`**: Docker Desktop isn't running. Start it and wait
  for the whale icon to settle, then run `npm run db:up` again.
- **Port 5432 already in use**: another Postgres is running. Stop it, or change the left-hand
  port in `docker-compose.yml` (e.g. `"5433:5432"`) and in `DATABASE_URL` in `.env`.
- **"column … does not exist" after pulling changes**: a new migration arrived. Run
  `npx prisma migrate deploy`, then `npm run db:seed`, then restart `npm run dev`.
- **"Prisma schema mismatch" or "missing tables" after pulling changes**: run
  `npx prisma migrate deploy`, then `npx prisma generate`, then restart `npm run dev`.
- **Styles look out of date after big changes**: stop the dev server, run
  `Remove-Item -Recurse -Force .next`, and start it again. Running `npm run build` while
  `npm run dev` is running can cause this, so stop the dev server before building.
- **A button fails with "Couldn't update…" right after pulling new code**: the dev server
  can miss newly added server actions. Stop it (Ctrl+C) and run `npm run dev` again.
- **Integration tests say they can't reach Postgres**: run `npm run db:up` first.
- **npm warns about `install-scripts`**: npm 11 blocks dependency install scripts unless
  they're approved in `package.json` → `allowScripts`. Prisma and esbuild are already approved.
- Country flags: Windows has no flag emoji, so the app serves a small flags-only font
  (`public/fonts/TwemojiCountryFlags.woff2`, from TalkJS's MIT-licensed
  country-flag-emoji-polyfill; flag artwork by Twitter/Twemoji, CC-BY 4.0). It only covers
  flag characters, so everything else stays in Overpass.

## Project layout

```
prisma/                schema.prisma, migrations, seed script
src/app/               routes (App Router): /trips/[id]/*, /t/[slug], /explore, /api/*
src/components/        UI: builder/, itinerary/, checklist/, map/, budget/, shared/, trip/
src/components/ui/     shadcn/ui primitives
src/lib/               pure logic (unit-tested): validation, itinerary, checklist, budget,
                       sharing, explore filters, money, dates, formatting
src/server/            session, permissions, read queries, server actions, rate limits
src/proxy.ts           fast redirect to /login for signed-out visitors
src/generated/         Prisma client (generated, not committed)
test/integration/      permission, privacy and validation tests (real database)
```
