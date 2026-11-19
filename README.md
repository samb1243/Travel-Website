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
| Three weeks in Thailand, Laos & Vietnam    | maya@example.com     | public     | overland, visas, statuses, baht & đồng prices |
| Two weeks by train: Amsterdam to Budapest  | lukas@example.com    | public     | planned with Sophie; costs split between them |
| Tour du Mont Blanc: 8 stages, 3 countries  | sophie@example.com   | public     | hut-to-hut hiking stages, gear, cash-only huts|
| Japan in cherry blossom season (draft)     | maya@example.com     | **private**| must never appear in Explore or share links   |
| Ten days in Bangkok and Chiang Mai         | aiko@example.com     | public     | overlaps with the next two, for Ideas         |
| Bangkok, Chiang Mai & Pai for two          | ben@example.com      | public     | ideas: shared hostel, class, night train      |
| Thailand on a budget: Bangkok to the north | priya@example.com    | public     | no Elephant Park, so that idea stays hidden   |

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
- **Statuses:** bookings (flights, stays, transport, activities, food) are **Booked**, **To
  book** or **No booking needed**, and separately can be **Paid**, **Pay on arrival** or **To
  pay** (optional). Gear and "other" items are **Bought**, **To buy** or **Already have**, or
  nothing; buying them covers the payment.
- **Progress** ("22/34 sorted") counts things that needed booking or buying: booked, bought
  and already-owned count as sorted; "No booking needed" and gear without a status are left out.
- **Colours:** each kind of item and each status has its own colour. Change any of them under
  Profile → Colours; your choices apply on every trip you look at, and only you see them.
- **Trip types:** pick all that fit, up to 4, from Backpacking, Multi-city, City break,
  Road trip, Rail journey, Hiking, Cycling, Beach & islands, Snow & skiing, Wildlife &
  safari, Family trip and Other. Explore's type filter finds a trip under any of its types.
- **New trip** needs only a name and at least one type. Dates, budget, travellers, currency (defaults to
  your home currency), description and cover photo (upload one or paste a link) are optional.
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
- **Address** (anything but gear): adds **Google Maps** and **Apple Maps** buttons. Buses and
  flights with From/To get directions between them instead (or to the pick-up address).
- **Photo**: upload one from your phone or computer, or paste a link to one on the web.
- Cards show everything you entered: operator, address, notes, photo, links.
- Tap a card to edit it, move it to another stop, or delete it.
- Times are local wall-clock times where the thing happens; they never shift with your
  phone's time zone.

### Import from email

**Import from email** (next to the Route heading) adds bookings from a confirmation email.

- Paste the email, or choose a saved `.eml` file (Gmail: ⋮ → Download message; Outlook: File →
  Save as). A saved file is opened in your browser, so attachments never leave your device.
- **Built-in booking data first:** many airlines, hotels, Booking.com, rail, bus and event sites
  put the booking in the email as schema.org data (what Gmail uses for its trip cards).
  Tripster reads flights, stays, trains, buses, ferries, car rentals, restaurants and events
  from it. Free, and nothing leaves the server.
- **Claude for the rest (optional):** if the email has no such data, **Read it with Claude**
  sends the email's text (nothing else about you or the trip) to Anthropic's API and gets the
  bookings back. Only when you press the button, and only when `ANTHROPIC_API_KEY` is set in
  `.env` (otherwise the option doesn't appear). It uses Claude Opus 5.5 with a fixed answer
  format and low effort, typically a few cents per email; at most 10 emails per person per hour.
- Each booking found shows its date, the stop it was matched to (by place name, else by date)
  and its reference. **Check & add** opens the normal item form, filled in, to check and
  change before saving; nothing is saved until you do. Dates and times are the local times
  in the email, and anything that isn't a valid date, time or known currency is left blank.

### Tickets & documents

Each booking can hold its boarding passes, e-tickets, visas and confirmations.

- In the booking's form: **Add a ticket or document** (a PDF or a photo, up to 4 MB; up to 10
  per booking and 150 per trip). Saved straight away; remove with the bin button.
- They show as chips on the booking (Overview, Itinerary, Checklist) and open in the browser's
  own viewer, in a new tab.
- **Private:** a document is only ever served to people planning that trip, checked on every
  request (`src/app/documents/[id]/route.ts`); anyone else gets the same "not found" as a file
  that doesn't exist. Never on public or link-only pages, never copied, never cached by the
  browser beyond this app's own offline copy.
- Only real PDFs and photos are accepted, judged by the file's contents, not its name. PDFs are
  kept exactly as uploaded; photos are re-encoded (dropping camera data such as GPS) and kept
  sharp enough for QR codes.
- **Offline:** documents on saved trips are saved with them, and open with no signal. Logging
  out deletes them from the device along with everything else.

### Ideas from other travellers

Under each stop, **Ideas from other travellers** lists what other people stayed at, ate or did
there, from public trips through the same place (same OpenStreetMap place, or the same name
and country).

- An idea only shows once **at least 3 different travellers** have it in a public trip (one
  vote per person, however many trips), so nothing points back to one person's plans. Names
  that differ only by case, "&"/"and", punctuation or a note in brackets count as the same.
- Only public trips count: never private or link-only ones, never your own, and never trips you
  plan with others. Only what public trip pages already show is used (name, kind, provider,
  address, price); never notes, confirmations, dates or who planned it.
- Each idea shows how many travellers have it, the usual provider and address, and a typical
  price (the median, in your trip's currency: per night for stays, per person otherwise) when
  at least two of them priced it. Ideas already in your plans for that stop are marked.
- **Add** opens the normal item form filled in with the place (as "To book"), for you to set
  your own dates and price. Ideas are loaded only when you open them.
- In the demo data, Maya's Bangkok and Chiang Mai stops have ideas from Aiko's, Ben's and
  Priya's trips; Pai has none yet (only two of them went).

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

- Two views, switched at the top:
  - **Booking & buying**: To book → To buy → Booked → Bought → Already have → No booking
    needed. Tap the circle to mark something booked (or bought); tap again to undo.
  - **Payment**: To pay → Pay on arrival → Paid → "Payment not set" (priced, but no payment
    status yet). Tap the circle to mark something paid. Bought gear counts as paid.
- Each section is sorted by date (an item without its own date uses its stop's arrival date).
  The toast after a change has an Undo button.
- Tap a status pill to pick another status or payment. Tap anywhere else on a card to edit it.
- Things still to book or buy within 14 days are highlighted ("Book now · in 5 days"), ones
  within 45 days get a "Coming up" tag, and ones whose date has passed are highlighted red.
- An item still to book with a "Booking" link shows it as a button, so you can book in one tap.
- On a copied trip, items whose original had a confirmation show **Add your confirmation**
  until you add your own confirmation number or link.

### Map

- Numbered pins for each stop, joined by a dashed line in route order, on OpenStreetMap
  (via [Leaflet](https://leafletjs.com)).
- Tap a stop in the list to fly to it; tap a pin to highlight its row. The arrow button opens
  the stop in Google Maps (or your phone's maps app) for directions.
- Shows the rough route length ("about 2,226 km stop to stop, as the crow flies").
- Stops without a location are listed with a dashed number and a link to add one.
- Routes across the Pacific (e.g. Tokyo → Honolulu) take the short way over the 180° line.

### Budget

- Each trip has a main currency (set when you create or edit it). All sums are done in whole
  cents, so totals never drift.
- **Prices in other currencies:** next to an item's cost, pick the currency you'll actually
  pay in (e.g. THB 1,000 for a cooking class on a USD trip). The item shows "THB 1,000 ≈ $29.57",
  and the budget converts it into the trip's currency at today's rate. Change the trip's
  currency later and every price keeps the currency it was entered in.
- Rates come from [ExchangeRate-API](https://www.exchangerate-api.com)'s free open endpoint
  (no key, updated daily; "Rates by Exchange Rate API" is credited on the Budget tab). Only
  "today's euro rates" is requested, nothing about users or trips. The app keeps the latest
  rates in the `ExchangeRateSnapshot` table and in memory, refreshes them every 12 hours,
  and falls back to the last stored rates, then to rough built-in ones (`src/lib/fx.ts`),
  if the service can't be reached. Set `EXCHANGE_RATES_URL` to use another source with the
  same response format.
- Planned spend against your budget, with a bar that turns amber at 90% and red when over,
  plus what's left (or how much you're over).
- Per person, per day, and per person per day. Costs are totals for the whole group, so
  "per person" divides by the trip's number of travellers.
- "How much is paid": spend split into Paid, Pay on arrival, Still to pay and Payment not set
  (bought gear counts as paid), with a warning for money tied up in things not booked or
  bought yet (their prices may change).
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
- **Explore** (`/explore`) lists other people's public trips, newest first (your own trips,
  and ones you plan together, are left out). Filter by type, continent, then one or more
  countries, minimum and maximum days, and minimum and maximum budget per person in your home
  currency (or any other). Filters live in the URL, so a filtered view can be shared.
  Budgets are compared in euros, converted when the trip was last changed, only for
  filtering; trips always show their own currency.
- **Save** keeps someone's trip under "Saved from Explore" on My trips. If its owner makes it
  private, it disappears from your list.
- **Copy this trip** (log in first) makes your own private copy: every stop, booking idea,
  cost, address, photo and link, with personal details left behind and "Based on X's trip"
  credited. Pick a new start date and every date moves to match. On your own trip the button
  says **Duplicate**. For the new traveller:
  - Booked becomes **To book**, bought or already-have gear becomes **To buy**, and Paid
    becomes **To pay**. "Pay on arrival" and "No booking needed" stay (they're how the place works).
  - Flights and buses/trains keep their day but lose their times, since the times won't match
    on new dates; fill them in once booked.
  - Items whose original had a confirmation show **Add your confirmation** until you add yours.

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

## Offline and the home screen

Tripster can be added to a phone's home screen, where it opens like an app, and your trips
open with no signal (read-only).

- **Add to home screen:** iPhone: Safari → Share → Add to Home Screen. Android: Chrome menu →
  Install app (or Add to Home screen). It opens on My trips.
- **What's saved:** every trip page you open (Overview, Itinerary, Checklist, Budget, Map),
  My trips, and shared trip pages. Opening My trips also saves your current and upcoming trips
  (up to 8, four tabs each) in the background, and refreshes them every 6 hours. My trips
  shows "2 trips saved for offline use · updated 5 min ago" with an **Update now** button.
- **With no connection:** saved pages open as they were when saved, including confirmation
  numbers and private notes (that's the point: your bookings at the border). A strip under the
  header says you're offline, or which saved copy you're looking at. Tabs and links between
  saved pages work. Anything not saved shows a "You're offline" page listing what is.
  Changes (ticking things off, editing) need a connection. Map tiles need a connection too.
- **Privacy:** copies stay on the device, in the browser's own storage. **Logging out deletes
  them**, and if someone else logs in on the same device, the previous person's copies are
  deleted first. Only pages you can already see are saved; the offline page itself is saved
  signed out, so it holds nothing personal.
- **How:** a small service worker (`public/sw.js`, no library) and `src/lib/offline.ts`. Pages
  are network-first: always fresh when online, the saved copy only when the network fails.
  It runs in production builds only (`npm run build && npm start`), since in development it
  would keep serving old pages; set `NEXT_PUBLIC_OFFLINE_IN_DEV=1` to try it with `npm run dev`.
  Icons are generated from the logo with `npx tsx scripts/make-icons.mts`.
- **To test offline on a computer:** run the production build, open My trips twice (the first
  visit installs the service worker), wait for "saved for offline use", then stop the server or
  turn off Wi-Fi and open a trip.

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

### Splitting costs

On a trip with more than one person, each booking's form has **Splitting the cost**:

- **Who paid** (someone on the trip, or not said yet) and **Split between** (everyone by
  default; switch people off for things only some of you do).
- The Budget tab's **Who paid** card shows what each person paid, their share and their
  balance ("gets back €37.50", "owes €37.50"), all in the trip's currency (foreign prices are
  converted), worked out to the cent.
- **To settle up** lists the fewest payments that square everyone. **Mark as paid** records
  one; recorded payments can be undone. If the trip's currency changes later, earlier payments
  are converted.
- Bookings without a "Who paid" aren't split, and the card says how much that is. If someone
  leaves the trip, bookings only they shared are split between everyone left.
- Who paid, the split and payments are the group's own business: never on public or unlisted
  pages, and not copied.
- In the demo data, Lukas's rail trip is planned with Sophie (log in as either).

### Reminder emails

Everyone planning a trip (owner and members) gets:

- **Still to book:** when something on the trip is still "to book" or "to buy" and it's 2 weeks
  away, then again at 3 days. Bookings without a date count from the day you arrive at their
  stop. Everything due that day comes in one email per trip.
- **Starts tomorrow:** the day before the trip's start date, with the first stop and how many
  things are still to book.

Each reminder is sent once, however often the job runs. Switch them off under **Profile →
Emails**, or with **Stop reminder emails** at the bottom of any reminder (no login needed;
the link only works for the account it was sent to, and the page asks before switching
off, since mail scanners open links too). Mail apps' own "Unsubscribe" button works as well.

The job runs once a day on Vercel (`vercel.json`, 07:00 UTC), protected by `CRON_SECRET`.
**Try it locally:** with the dev server running, open
[http://localhost:3000/api/cron/reminders](http://localhost:3000/api/cron/reminders). It
shows how many trips and emails it handled, and the emails print in the `npm run dev`
terminal. A second run sends nothing new. To see them again, give a demo trip a start date
of tomorrow, or a "to book" item a date 3 or 14 days away.

## Security

How the three rules ("validate inputs", "users can only edit their own trips", "never expose
private trips") are enforced, and where.

**Permissions: users can only edit their own trips**
- Every server action is a public HTTP endpoint, so each one checks the caller itself before
  touching data, whatever the UI sends (`src/server/actions/*`). There are 33, and nothing else
  is exported from those files (anything exported from a `"use server"` file becomes callable).
- Access checks live in one place, `src/server/permissions.ts`: `requireTripEditor`,
  `requireStopEditor` and `requireItemEditor` allow the owner and members; `requireTripOwner`
  guards delete, visibility, invites and removing people. Stops and items are looked up
  *through* their trip's editors, so passing your own trip id with someone else's item id
  doesn't work.
- Two need no login: **Stop reminder emails** (`unsubscribeFromEmail`, and the one-click
  `POST /api/unsubscribe`) only switch off reminders, and only with a link signed for that
  account (HMAC of the user id with the server secret). The reminder job
  (`/api/cron/reminders`) refuses calls without `CRON_SECRET` on the live site.
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
  `javascript:` or `data:` links). Statuses must fit the kind of item (a stay can't be
  "bought"). Photos are `https://` links or this site's own `/img/<id>`. Invalid Explore
  filters in the URL are ignored.
- **Booking documents** (`/api/documents`, `/documents/<id>`): for the trip's planners only,
  on every request; file type judged from the contents; PDFs served without the page policy
  (so the browser's PDF viewer works) but with `nosniff`, no framing and no referrer.
- **Uploads** (`/api/uploads`, logged in only, 20 a minute and 60 a day per person, 10 MB):
  every file is decoded and re-encoded as WebP with [sharp](https://sharp.pixelplumbing.com),
  so anything that isn't really an image is rejected, and camera metadata such as GPS
  position is dropped. They're served from `/img/<id>` with `nosniff` and a sandboxing CSP.
  Ids are random and unlisted; a photo is as private as the trip page that links to it.
- **Custom colours** are saved only as known keys with `#rrggbb` values, so they can't inject
  CSS; the copy kept in the browser is checked against the exact expected form before use.
- Sign-up and Google sign-in bypass our forms, so user names and avatars are cleaned again in
  Better Auth's database hooks; Better Auth's generic "update user" endpoint is switched off.
- Caps per account: 200 trips, 100 stops and 500 items per trip, 10 links per item. Creating
  or copying trips is limited to 20 a minute, place search to 30 a minute.

**Other protections**
- Passwords are hashed by Better Auth (scrypt); sessions are HTTP-only cookies. Sign-in
  redirects only go to paths on this site (`src/lib/safe-redirect.ts`).
- Security headers on every page (`next.config.ts`): no framing by other sites, no MIME
  sniffing, a strict referrer policy, camera/microphone/location off, HSTS on HTTPS.
- **Content-Security-Policy:** scripts, styles and fonts only from Tripster itself, no
  fetching or posting data to other sites, no plugins or frames; images from any `https` site
  (covers, avatars and map tiles are links people choose). It isn't nonce-based on purpose:
  nonces would switch off Partial Prerendering and don't fit pages saved for offline use, so
  inline scripts (Next.js's page data, the theme script) stay allowed.
- Errors show a friendly page with a reference number that matches the server log, never the
  error itself (`src/app/error.tsx`, `src/app/global-error.tsx`).
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

### Browser tests

Real clicks through the main journeys, in Chrome sized like a phone (Pixel 7), on a
production build:

- **Sign up and plan a first trip:** create a trip, add a stop with place search, add a
  booking, tick it off on the checklist, see it in the budget.
- **Logging in and out:** a wrong password is refused, logging out ends the session.
- **Privacy:** Explore lists public trips only; public pages leave out confirmation numbers;
  a private trip says "Page not found" to visitors and to other users; planning pages ask
  you to log in.
- **Copying** a public trip from Explore, without its owner's personal details.
- **Planning together:** a member sees the shared trip, confirmation numbers and who owes what.
- **Offline:** after visiting My trips, an upcoming trip opens with the connection off.

```powershell
npm run db:up               # needs Postgres running, and Google Chrome installed
npm run test:e2e            # builds the app, starts it on port 3100, runs the tests (~2 min)
npm run test:e2e:report     # after a failure in CI: open a downloaded report
```

They use their own `tripstack_e2e` database, reset and filled with the demo data each run
(override with `E2E_DATABASE_URL`; the name must end in `_e2e`), so your dev data is never
touched, and you can keep `npm run dev` running alongside. Place search answers with a
made-up result and every request to other sites (map tiles, photos) is blocked, so the tests
don't need the internet. On a failure there's a screenshot and a step-by-step trace in
`test-results/` (open one with `npx playwright show-trace <path to trace.zip>`). The tests
live in `e2e/`, the setup in `playwright.config.ts`.

Two things the tests rely on that are worth knowing: pages stream, so a "not found" page
still has HTTP status 200 (the tests check what's on screen), and logins are limited to 3
tries per 10 seconds, so the login test waits and retries if it's refused.

**On GitHub:** every push and pull request runs lint, types, unit tests, integration tests
(against a Postgres service), a production build and the browser tests
(`.github/workflows/ci.yml`). The result shows as a tick or cross next to each commit, and in
the repo's **Actions** tab. If the browser tests fail, the run's **Artifacts** has
`browser-test-results` with screenshots and traces.

### Accessibility

Checked against WCAG 2.1 AA with [axe-core](https://github.com/dequelabs/axe-core) on every main
page, in light and dark mode at phone size (all clean), plus keyboard checks:

- **Skip to content** is the first thing Tab reaches; every control has a visible focus ring.
- Sheets (booking forms, imports, ideas) keep focus inside while open, close with Escape, and
  hand focus back to what opened them.
- Booking cards are buttons named "Edit" plus what they show, so the spoken name matches
  the screen; status chips and filters say whether they're pressed.
- Headings go in order (one `h1` per page); text meets 4.5:1 contrast, icons and controls 3:1.
  Custom colours pick black or white text for whichever reads better.

Automated checks catch only part of the problems; a pass with a real screen reader (NVDA on
Windows, VoiceOver on iPhone) is still worth doing before launch.

## Before going live

**[DEPLOY.md](DEPLOY.md)** walks through putting Tripster online on Vercel + Neon, with Resend
for email and MapTiler for maps: accounts to create, settings to copy, and a checklist to
confirm it works. **[GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md)** is the short to-do list to tick
off. What the code already does for a live site:

- **Settings check:** in production the server refuses to start without `DATABASE_URL`, a real
  `BETTER_AUTH_SECRET` and an `https://` `BETTER_AUTH_URL` (`src/lib/env-check.ts`), and logs a
  warning for each optional service that isn't set up.
- **Email:** password resets go out through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are
  set (`src/server/email.ts`); locally they're printed in the terminal.
- **Maps:** MapTiler tiles when `NEXT_PUBLIC_MAPTILER_KEY` is set, OpenStreetMap's own tiles
  otherwise (`src/lib/map-tiles.ts`).
- **Rate limits** are kept in Postgres (`AppRateLimit`, and Better Auth's `RateLimit` for
  log-in and sign-up), so they hold across every server instance; place search keeps to one
  request a second for the whole site the same way.
- **Migrations** run on every Vercel deploy (`vercel-build`), through Neon's direct connection
  (`DIRECT_URL`).

Still worth doing as it grows:

- [ ] If the app ever needs a strict script policy (no inline scripts at all): per-request
      nonces generated in `src/proxy.ts`, at the cost of Partial Prerendering.
- [ ] Move uploaded photos from the database (`Upload` table) to file storage (Vercel Blob,
      Cloudflare R2) behind the same `/img/<id>` route (`src/server/uploads.ts`).
- [ ] Pasted photo and avatar links load from other sites in viewers' browsers. Consider
      re-hosting them too if that matters.
- [ ] Check the name "Tripster" isn't taken where you launch; other travel businesses use it.

## Phase 2 (planned, not built)

The code leaves room for each of these:

- **Forward booking emails** to a personal address instead of pasting them: needs an inbound
  email service (e.g. Postmark) once hosted; it would feed `readBookingEmail` in
  `src/server/actions/email-import.ts`.

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
                       sharing, explore filters, money, currency conversion, dates, formatting
src/server/            session, permissions, read queries, server actions, rate limits,
                       exchange rates
src/proxy.ts           fast redirect to /login for signed-out visitors
src/generated/         Prisma client (generated, not committed)
test/integration/      permission, privacy and validation tests (real database)
e2e/                   browser tests of the main journeys (Playwright, playwright.config.ts)
```
