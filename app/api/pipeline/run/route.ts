/* The pipeline endpoint. Vercel cron calls GET with the cron secret; the
   operator can trigger a sweep with POST from an authenticated session. */

import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/intel/run";
import { currentSeat } from "@/lib/auth";
import { hasSupabaseEnv, isDemoMode } from "@/lib/mode";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

async function execute() {
  if (isDemoMode() || !hasSupabaseEnv()) {
    return NextResponse.json({ error: "pipeline needs the database" }, { status: 409 });
  }
  try {
    const summary = await runPipeline();
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message.slice(0, 300) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "no" }, { status: 401 });
  }
  return execute();
}

export async function POST(req: NextRequest) {
  if (!cronAuthorized(req)) {
    const seat = await currentSeat();
    if (seat !== 4) return NextResponse.json({ error: "no" }, { status: 401 });
  }
  return execute();
}
