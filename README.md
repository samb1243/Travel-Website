# TripStack

Plan and share trips: backpacking routes, multi-city trips and hikes. Keep the route, bookings,
links and budget in one place, then publish a trip so others can copy it.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 + shadcn/ui ·
PostgreSQL 17 (Docker) + Prisma 7 · Zod. Coming in later steps: Better Auth, Leaflet + OpenStreetMap, dnd-kit.

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
npm run db:up
npx prisma migrate deploy
npm run db:seed
```

- `npm install` also runs `prisma generate`.
- `npm run db:up` starts Postgres in Docker on `localhost:5432` and waits until it's ready.
- `npx prisma migrate deploy` creates the tables.
- `npm run db:seed` loads the example trips below.

## Example data

`npm run db:seed` creates three demo users and four trips. You can run it again at any time:
it deletes and recreates the demo users' trips and leaves everything else alone.

| Trip                                       | Owner                | Visibility | Shows off                                     |
| ------------------------------------------ | -------------------- | ---------- | --------------------------------------------- |
| Three weeks in Thailand, Laos & Vietnam    | maya@example.com     | public     | overland transport, visas, mixed statuses     |
| Two weeks by train: Amsterdam to Budapest  | lukas@example.com    | public     | rail pass, 2 travellers, 5 countries          |
| Tour du Mont Blanc: 8 stages, 3 countries  | sophie@example.com   | public     | hut-to-hut hiking stages, gear, cash-only huts|
| Japan in cherry blossom season (draft)     | maya@example.com     | **private**| must never appear in Explore or share links   |

Some items contain confirmation codes, private notes and "confirmation" links. These are
personal and must never appear on shared pages or in copies.

Demo logins arrive in step 3.

## Run the app

```powershell
npm run dev
```

Open http://localhost:3000. To check the database connection, open
http://localhost:3000/api/health; it should return `{"ok":true,"database":"up"}`.

## Useful scripts

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Start the dev server                           |
| `npm run build`      | Production build                               |
| `npm run lint`       | ESLint                                         |
| `npm run typecheck`  | TypeScript check                               |
| `npm test`           | Unit tests (Vitest)                            |
| `npm run db:up`      | Start Postgres (Docker)                        |
| `npm run db:down`    | Stop Postgres (data is kept in a Docker volume)|
| `npm run db:migrate` | Create and apply a migration after schema edits|
| `npm run db:seed`    | Load example trips                             |
| `npm run db:reset`   | Wipe the database and re-apply migrations (then run `db:seed`) |
| `npm run db:studio`  | Browse the database in Prisma Studio           |

## Troubleshooting

- **`failed to connect to the docker API`**: Docker Desktop isn't running. Start it and wait
  for the whale icon to settle, then run `npm run db:up` again.
- **Port 5432 already in use**: another Postgres is running. Stop it, or change the left-hand
  port in `docker-compose.yml` (e.g. `"5433:5432"`) and in `DATABASE_URL` in `.env`.
- **npm warns about `install-scripts`**: npm 11 blocks dependency install scripts unless
  they're approved in `package.json` → `allowScripts`. Prisma and esbuild are already approved.

## Project layout

```
prisma/              schema.prisma, migrations, seed script
src/app/             routes (App Router)
src/components/      shared UI; src/components/ui = shadcn/ui
src/lib/             db client, status colours, helpers
src/server/          data access, permission checks, server actions (from step 2)
src/generated/       Prisma client (generated, not committed)
```
