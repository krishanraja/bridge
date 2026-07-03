/* The operator releases what the Sunday job proposed: approve, adjust, or skip.
   Approve applies the source weights and lane order; skip changes nothing. */

import { NextResponse, type NextRequest } from "next/server";
import { currentSeat } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { applyProposal } from "@/lib/loop/learn";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (seat !== 4) return NextResponse.json({ error: "operator only" }, { status: 401 });

  const { id, decision } = (await req.json()) as {
    id?: number;
    decision?: "approve" | "adjust" | "skip";
  };
  if (!id || !decision) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const sb = supabaseService();
  const status = decision === "approve" ? "approved" : decision === "adjust" ? "adjusted" : "skipped";
  await sb.from("learn_proposals").update({ status, decided_by: seat }).eq("id", id);
  await sb.from("audit_log").insert({ seat, action: "learn_decide", detail: { id, decision } });

  let applied = false;
  if (decision === "approve") {
    const r = await applyProposal(id);
    applied = r.applied;
  }
  return NextResponse.json({ ok: true, decision, applied });
}
