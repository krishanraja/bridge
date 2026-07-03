/* Operator edits the draft during the review window. The edit re-derives the
   citation lines and re-renders audio; the edit rate is a learning signal. */

import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { prerenderBrief } from "@/lib/loop/prerender";
import { currentSeat } from "@/lib/auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (seat !== 4) return NextResponse.json({ error: "operator only" }, { status: 401 });

  const { day, kind, script } = (await req.json()) as {
    day?: string;
    kind?: "morning" | "close";
    script?: string;
  };
  const clean = (script ?? "").trim();
  if (!day || !clean) return NextResponse.json({ error: "empty" }, { status: 400 });
  const briefKind = kind === "close" ? "close" : "morning";

  const line_refs = clean.split("\n").map((line, i) => ({
    line: i,
    refs: [...line.matchAll(/\[([A-Z]\d+)\]/g)].map((m) => m[1]),
  }));

  const sb = supabaseService();
  const { error } = await sb
    .from("briefs")
    .update({ script: clean, line_refs, edited_by_operator: true, audio_path: null })
    .eq("day", day)
    .eq("kind", briefKind);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("events").insert({
    seat,
    type: "operator_edit",
    subject_type: "brief",
    subject_id: `${day}:${briefKind}`,
    value: { chars: clean.length },
  });
  await sb.from("audit_log").insert({
    seat,
    action: "brief_edit",
    detail: { day, kind: briefKind },
  });

  const audio = await prerenderBrief(day, briefKind);
  return NextResponse.json({ ok: true, audio });
}
