/* Compose the day's brief and pre-render its audio. Cron at 06:45 ET, or the
   operator on demand. The morning brief holds unreleased for the review window. */

import { NextResponse, type NextRequest } from "next/server";
import { compose, saveDraft } from "@/lib/loop/compose";
import { prerenderBrief } from "@/lib/loop/prerender";
import { currentSeat } from "@/lib/auth";
import { hasSupabaseEnv, isDemoMode } from "@/lib/mode";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function run(kind: "morning" | "close") {
  if (isDemoMode() || !hasSupabaseEnv()) {
    return NextResponse.json({ error: "compose needs the database" }, { status: 409 });
  }
  try {
    const result = await compose(kind);
    /* The morning brief releases at 07:25; the close releases at 15:00. */
    await saveDraft(result, false);
    const audio = await prerenderBrief(result.day, kind);
    return NextResponse.json({
      day: result.day,
      kind,
      words: result.script.split(/\s+/).length,
      lines: result.line_refs.length,
      audio,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 240) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "no" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind") === "close" ? "close" : "morning";
  return run(kind);
}

export async function POST(req: NextRequest) {
  if (!cronAuthorized(req)) {
    const seat = await currentSeat();
    if (seat !== 4) return NextResponse.json({ error: "no" }, { status: 401 });
  }
  const kind = req.nextUrl.searchParams.get("kind") === "close" ? "close" : "morning";
  return run(kind);
}
