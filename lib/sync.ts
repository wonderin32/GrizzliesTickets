import { ensureSchema, getSql } from "./db";

const SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";
const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

type NbaTeam = { teamTricode: string; teamCity: string; teamName: string };
type NbaGame = {
  gameId: string;
  gameDateTimeUTC: string;
  gameStatusText?: string;
  gameLabel?: string;
  gameSubtype?: string;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
};

function memphisDate(iso: string) {
  // en-CA formats as YYYY-MM-DD
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// Pulls the official NBA schedule and upserts every Grizzlies regular-season
// home game. Family picks/notes are never overwritten.
export async function syncSchedule() {
  await ensureSchema();
  const res = await fetch(SCHEDULE_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NBA schedule fetch failed: ${res.status}`);
  const data = await res.json();
  const games: NbaGame[] = data.leagueSchedule.gameDates.flatMap((d: { games: NbaGame[] }) => d.games);
  const home = games.filter((g) => g.homeTeam?.teamTricode === "MEM" && g.gameId.startsWith("002"));
  if (home.length === 0) throw new Error("No Grizzlies home games found in NBA schedule");

  const sql = getSql();
  await sql.transaction([
    ...home.flatMap((g) => {
      const date = memphisDate(g.gameDateTimeUTC);
      const tbd = /tbd/i.test(g.gameStatusText ?? "");
      const tipoff = tbd ? null : g.gameDateTimeUTC;
      const label = /cup/i.test(g.gameLabel ?? "") || g.gameSubtype === "in-season" ? "NBA Cup" : null;
      const opponent = `${g.awayTeam.teamCity} ${g.awayTeam.teamName}`;
      return [
        // Adopt a matching fallback seed row so its picks/notes carry over.
        sql`UPDATE games SET game_id = ${g.gameId}
            WHERE game_id = ${"seed-" + date}
              AND NOT EXISTS (SELECT 1 FROM games WHERE game_id = ${g.gameId})`,
        sql`INSERT INTO games (game_id, game_date, tipoff, opponent, opponent_code, label)
            VALUES (${g.gameId}, ${date}, ${tipoff}, ${opponent}, ${g.awayTeam.teamTricode}, ${label})
            ON CONFLICT (game_id) DO UPDATE SET
              game_date = EXCLUDED.game_date, tipoff = EXCLUDED.tipoff,
              opponent = EXCLUDED.opponent, opponent_code = EXCLUDED.opponent_code,
              label = COALESCE(EXCLUDED.label, games.label)`,
      ];
    }),
    // Drop untouched seed rows that didn't match an official game.
    sql`DELETE FROM games WHERE game_id LIKE 'seed-%'
        AND slot1 IS NULL AND slot2 IS NULL AND notes = ''`,
    sql`INSERT INTO meta (key, value) VALUES ('last_sync', ${new Date().toISOString()})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  ]);
  return home.length;
}

// Syncs if the last successful sync is stale. Failures are logged, not thrown.
let lastAttempt = 0;
export async function syncIfStale() {
  if (Date.now() - lastAttempt < 10 * 60 * 1000) return;
  lastAttempt = Date.now();
  try {
    await ensureSchema();
    const rows = await getSql()`SELECT value FROM meta WHERE key = 'last_sync'`;
    const last = rows[0] ? Date.parse(rows[0].value as string) : 0;
    if (Date.now() - last < SYNC_INTERVAL_MS) return;
    await syncSchedule();
  } catch (e) {
    console.error("Schedule sync skipped:", e);
  }
}
