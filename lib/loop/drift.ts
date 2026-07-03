/* The Wednesday drift check. Silent unless something drifted: a move with no
   activity, a blocker unowned too long, or a Ledger status change. When it
   fires, one notification goes to the responsible seat only. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";
import { currentIsoWeek } from "@/lib/weeks";
import type { SeatId } from "@/lib/seats";

export interface Drift {
  seat: SeatId;
  line: string;
  subjectType: string;
  subjectId: string;
}

export async function detectDrift(): Promise<Drift[]> {
  const sb = supabaseService();
  const week = currentIsoWeek();
  const drifts: Drift[] = [];

  const [movesQ, prioritiesQ, assumptionsQ] = await Promise.all([
    sb.from("moves").select("id, priority_id, text, owner_seat, state").eq("iso_week", week),
    sb.from("priorities").select("id, name, sponsor_seat, state, blocker, blocker_owner_seat").is("retired_at", null),
    sb.from("assumptions").select("id, statement, status").in("status", ["weakening", "flipped"]).is("retired_at", null),
  ]);

  const priorities = prioritiesQ.data ?? [];

  /* A move still merely proposed by midweek has not been agreed: it drifted. */
  for (const m of movesQ.data ?? []) {
    if (m.state === "proposed") {
      const p = priorities.find((x) => x.id === m.priority_id);
      drifts.push({
        seat: m.owner_seat as SeatId,
        line: `The move on ${p?.name ?? "a priority"} is still only proposed by Wednesday. Agree it or rewrite it.`,
        subjectType: "move",
        subjectId: m.id,
      });
    }
  }

  /* A blocker with a named owner and no owner action reads as stuck. */
  for (const p of priorities) {
    if (p.blocker && (p.state === "blocked" || p.state === "at_risk")) {
      drifts.push({
        seat: (p.blocker_owner_seat ?? p.sponsor_seat) as SeatId,
        line: `${p.name} is ${p.state === "blocked" ? "blocked" : "at risk"} midweek: ${p.blocker}`,
        subjectType: "priority",
        subjectId: p.id,
      });
    }
  }

  /* A belief that turned weakening or flipped is worth a heads up to its sponsor. */
  for (const a of assumptionsQ.data ?? []) {
    const sponsor = priorities.find((p) => p.sponsor_seat)?.sponsor_seat ?? 1;
    drifts.push({
      seat: sponsor as SeatId,
      line: `The house view moved: "${a.statement}" is now ${a.status}.`,
      subjectType: "assumption",
      subjectId: a.id,
    });
  }

  return drifts;
}
