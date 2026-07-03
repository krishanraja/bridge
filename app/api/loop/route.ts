/* The weekly loop's scheduled beats. One endpoint, a step parameter, driven by
   Vercel cron. Every beat is idempotent and safe to replay.
   steps: drift (Wed 12:00), pulse_open (Mon 07:30), close_notify (Fri 15:00). */

import { NextResponse, type NextRequest } from "next/server";
import { detectDrift } from "@/lib/loop/drift";
import { pushToSeat } from "@/lib/push/send";
import { hasSupabaseEnv, isDemoMode } from "@/lib/mode";
import { SEAT_IDS } from "@/lib/seats";

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

async function step(name: string) {
  if (isDemoMode() || !hasSupabaseEnv()) {
    return NextResponse.json({ error: "needs the database" }, { status: 409 });
  }

  if (name === "drift") {
    const drifts = await detectDrift();
    /* Silent unless something drifted; one push per responsible seat. */
    const results = [];
    for (const d of drifts) {
      const r = await pushToSeat(d.seat, "drift", {
        title: "One thing drifted",
        body: d.line,
        url: d.subjectType === "assumption" ? "/ledger" : "/priorities",
      });
      results.push({ seat: d.seat, ...r });
    }
    return NextResponse.json({ step: "drift", drifted: drifts.length, results });
  }

  if (name === "pulse_open") {
    const results = [];
    for (const seat of SEAT_IDS) {
      const r = await pushToSeat(seat, "pulse_open", {
        title: "The Monday pulse is open",
        body: "Drag your confidence on each priority. Forty seconds.",
        url: "/table",
      });
      results.push({ seat, ...r });
    }
    return NextResponse.json({ step: "pulse_open", results });
  }

  if (name === "close_notify") {
    const results = [];
    for (const seat of SEAT_IDS) {
      const r = await pushToSeat(seat, "close", {
        title: "The week is closed",
        body: "The Friday scorecard is in. Sixty seconds.",
        url: "/today",
      });
      results.push({ seat, ...r });
    }
    return NextResponse.json({ step: "close_notify", results });
  }

  if (name === "morning_notify") {
    const results = [];
    for (const seat of SEAT_IDS) {
      const r = await pushToSeat(seat, "morning", {
        title: "The morning read is ready",
        body: "Ninety seconds on the market, the house, and today's call.",
        url: "/today",
      });
      results.push({ seat, ...r });
    }
    return NextResponse.json({ step: "morning_notify", results });
  }

  return NextResponse.json({ error: "unknown step" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "no" }, { status: 401 });
  return step(req.nextUrl.searchParams.get("step") ?? "");
}
