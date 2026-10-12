import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";
import { syncIfStale } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    await syncIfStale();
    const games = await getSql()`
      SELECT id, game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date, tipoff,
             opponent, opponent_code, slot1, slot2, notes
      FROM games ORDER BY game_date, tipoff NULLS LAST`;
    return NextResponse.json({ games });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
