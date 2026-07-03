/* Release check. Cron hits this at 07:25 (morning) and 15:00 (close): if a
   draft is still unreleased, the current version auto-releases. The operator
   can also release early from the review card. */

import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { prerenderBrief } from "@/lib/loop/prerender";
import { currentSeat } from "@/lib/auth";
import { hasSupabaseEnv, isDemoMode } from "@/lib/mode";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function release(kind: "morning" | "close", byOperator: boolean) {
  if (isDemoMode() || !hasSupabaseEnv()) {
    return NextResponse.json({ error: "needs the database" }, { status: 409 });
  }
  const sb = supabaseService();
  const day = new Date().toISOString().slice(0, 10);
  const { data: brief } = await sb
    .from("briefs")
    .select("released_at, audio_path")
    .eq("day", day)
    .eq("kind", kind)
    .maybeSingle();

  if (!brief) return NextResponse.json({ released: false, reason: "no draft" });
  if (brief.released_at) return NextResponse.json({ released: true, already: true });

  /* A last chance to render audio for an edited draft before it lands. */
  if (!brief.audio_path) await prerenderBrief(day, kind);

  await sb
    .from("briefs")
    .update({ released_at: new Date().toISOString(), edited_by_operator: byOperator })
    .eq("day", day)
    .eq("kind", kind);

  return NextResponse.json({ released: true, day, kind });
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "no" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind") === "close" ? "close" : "morning";
  return release(kind, false);
}

export async function POST(req: NextRequest) {
  if (!cronAuthorized(req)) {
    const seat = await currentSeat();
    if (seat !== 4) return NextResponse.json({ error: "no" }, { status: 401 });
  }
  const kind = req.nextUrl.searchParams.get("kind") === "close" ? "close" : "morning";
  return release(kind, true);
}
