# Grizzlies Game Tracker

Shared tracker for Memphis Grizzlies home games (2026–27). Two ticket dropdowns + a note per game. Changes save instantly and sync to everyone (polls every 15s). No login.

**Stack:** Next.js (App Router) + Postgres via Neon (`@neondatabase/serverless`).

## Deploy on Vercel
1. Import this repo in Vercel.
2. **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`.
3. Deploy. Tables are created automatically on first load.

## Schedule data
- On first load the DB is seeded with a partial fallback list (`lib/seed.ts`).
- The app then pulls the **official NBA schedule** (`cdn.nba.com`) and upserts every Grizzlies regular-season home game — opponents, dates, tip times. Re-syncs automatically every 12h. Picks and notes are never overwritten.
- Force a refresh: `curl -X POST https://<your-app>.vercel.app/api/sync`

## Local dev
```
echo "DATABASE_URL=postgres://..." > .env.local
npm install && npm run dev
```
