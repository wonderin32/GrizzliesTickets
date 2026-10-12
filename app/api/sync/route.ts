import { NextResponse } from "next/server";
import { syncSchedule } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Manually refresh the schedule from the NBA (also runs automatically every 12h).
export async function POST() {
  try {
    const count = await syncSchedule();
    return NextResponse.json({ ok: true, homeGames: count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
