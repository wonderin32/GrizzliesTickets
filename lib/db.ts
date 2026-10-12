import { neon } from "@neondatabase/serverless";
import { SEED_GAMES } from "./seed";

export function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon/Postgres database in Vercel.");
  return neon(url);
}

let ready: Promise<void> | null = null;

// Creates tables on first use and seeds the fallback schedule if empty.
export function ensureSchema() {
  ready ??= (async () => {
    const q = getSql();
    await q`CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      game_id TEXT UNIQUE NOT NULL,
      game_date DATE NOT NULL,
      tipoff TIMESTAMPTZ,
      opponent TEXT NOT NULL,
      opponent_code TEXT,
      slot1 TEXT,
      slot2 TEXT,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await q`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const [{ count }] = await q`SELECT count(*)::int AS count FROM games`;
    if (count === 0) {
      await q.transaction(
        SEED_GAMES.map(
          (g) => q`INSERT INTO games (game_id, game_date, tipoff, opponent, opponent_code)
                   VALUES (${"seed-" + g.date}, ${g.date}, ${g.tipoff ?? null}, ${g.opponent}, ${g.code})
                   ON CONFLICT (game_id) DO NOTHING`
        )
      );
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
