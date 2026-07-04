/* Beliefs no one is tending drift toward fifty — honest uncertainty rather than
   stale confidence. This closes a loop that was defined (decayTowardFifty) but
   never called. It is self-limiting: a decay writes a history point dated today,
   which resets the quiet clock, so a belief drifts at most about one point per
   quiet fortnight. */

import "server-only";
import { decayTowardFifty } from "@/lib/ledger/confidence";

const FORTNIGHT_MS = 14 * 86400000;

export async function decayBeliefs(): Promise<{ decayed: number }> {
  const { supabaseService } = await import("@/lib/supabase/service");
  const svc = supabaseService();

  const { data: assumptions } = await svc
    .from("assumptions")
    .select("id, confidence, history, created_at, status")
    .is("retired_at", null);
  if (!assumptions?.length) return { decayed: 0 };

  const { data: evidence } = await svc
    .from("assumption_evidence")
    .select("assumption_id, created_at");
  const lastEvidence: Record<string, number> = {};
  for (const e of (evidence ?? []) as { assumption_id: string; created_at: string }[]) {
    const t = Date.parse(e.created_at);
    if (!lastEvidence[e.assumption_id] || t > lastEvidence[e.assumption_id]) {
      lastEvidence[e.assumption_id] = t;
    }
  }

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  let decayed = 0;

  for (const a of assumptions as {
    id: string;
    confidence: number;
    history: { day: string; confidence: number }[] | null;
    created_at: string;
    status: string;
  }[]) {
    if (a.status === "retired") continue;
    const hist = a.history ?? [];
    const lastHistoryDay = hist.length
      ? Date.parse(hist[hist.length - 1].day)
      : Date.parse(a.created_at);
    const lastActivity = Math.max(lastEvidence[a.id] ?? 0, lastHistoryDay);
    if (now - lastActivity < FORTNIGHT_MS) continue;

    const conf = Number(a.confidence);
    const next = Math.round(decayTowardFifty(conf, 1));
    if (next === Math.round(conf)) continue;

    const history = [...hist, { day: today, confidence: next }].slice(-120);
    await svc.from("assumptions").update({ confidence: next, history }).eq("id", a.id);
    decayed++;
  }

  return { decayed };
}
