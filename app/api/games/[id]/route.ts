import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";
import { isOption, NOTES_MAX } from "@/lib/options";

export const dynamic = "force-dynamic";

// Body: { field: "slot1" | "slot2" | "notes", value: string | null }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { field, value } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await ensureSchema();
  const sql = getSql();
  let rows;
  if (field === "slot1" || field === "slot2") {
    if (value !== null && !isOption(value)) {
      return NextResponse.json({ error: "Bad value" }, { status: 400 });
    }
    rows =
      field === "slot1"
        ? await sql`UPDATE games SET slot1 = ${value}, updated_at = now() WHERE id = ${id} RETURNING id`
        : await sql`UPDATE games SET slot2 = ${value}, updated_at = now() WHERE id = ${id} RETURNING id`;
  } else if (field === "notes") {
    if (typeof value !== "string") return NextResponse.json({ error: "Bad value" }, { status: 400 });
    const notes = value.slice(0, NOTES_MAX);
    rows = await sql`UPDATE games SET notes = ${notes}, updated_at = now() WHERE id = ${id} RETURNING id`;
  } else {
    return NextResponse.json({ error: "Bad field" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
