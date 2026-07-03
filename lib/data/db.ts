/* Database data source. Raw rows in, shared derivations out. */

import { supabaseServer } from "@/lib/supabase/server";
import type { Decision, Move, Priority, Pulse, Signal, Thread } from "@/lib/types";
import type { SeatId } from "@/lib/seats";
import { SEAT_IDS } from "@/lib/seats";
import { currentIsoWeek, isoWeekShift } from "@/lib/weeks";
import {
  deriveFocus,
  derivePriorityViews,
  deriveTable,
  topSignals,
  weekMoveDots,
} from "./derive";
import type { LedgerData, PriorityView, TableData, TodayData } from "./views";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function dbToday(): Promise<TodayData> {
  const sb = await supabaseServer();
  const day = todayISO();
  const week = currentIsoWeek();

  const [signalsQ, prioritiesQ, movesQ, decisionsQ, threadsQ, briefQ] =
    await Promise.all([
      sb.from("signals").select("*").eq("day", day),
      sb.from("priorities").select("*").is("retired_at", null),
      sb.from("moves").select("*").eq("iso_week", week),
      sb.from("decisions").select("*").eq("state", "open"),
      sb.from("threads").select("*"),
      sb
        .from("briefs")
        .select("*")
        .eq("day", day)
        .eq("kind", "morning")
        .not("released_at", "is", null)
        .maybeSingle(),
    ]);

  const signals = (signalsQ.data ?? []) as Signal[];
  const priorities = (prioritiesQ.data ?? []) as Priority[];
  const moves = (movesQ.data ?? []) as Move[];
  const decisions = (decisionsQ.data ?? []) as Decision[];
  const threads = (threadsQ.data ?? []) as Thread[];

  return {
    brief: briefQ.data
      ? {
          day: briefQ.data.day,
          script: briefQ.data.script,
          audioPath: briefQ.data.audio_path,
          released: true,
        }
      : null,
    focus: deriveFocus({
      decisions,
      priorities,
      moves,
      signals,
      threads,
      todayISO: day,
      isoWeek: week,
    }),
    topSignals: topSignals(signals, 3),
    weekMoves: weekMoveDots(priorities, moves, week),
    demo: false,
  };
}

export async function dbDeck(): Promise<Signal[]> {
  const sb = await supabaseServer();
  const day = todayISO();
  const [signalsQ, verdictsQ, seatQ] = await Promise.all([
    sb
      .from("signals")
      .select("*")
      .eq("day", day)
      .order("score", { ascending: false })
      .limit(12),
    sb
      .from("events")
      .select("subject_id, seat, type")
      .in("type", ["signal_act", "signal_hold", "signal_kill"])
      .gte("created_at", `${day}T00:00:00Z`),
    sb.auth.getUser(),
  ]);
  const email = seatQ.data.user?.email?.toLowerCase();
  const { seatForEmail } = await import("@/lib/seats");
  const seat = email ? seatForEmail(email) : null;
  const dismissed = new Set(
    (verdictsQ.data ?? []).filter((v) => v.seat === seat).map((v) => v.subject_id),
  );
  return ((signalsQ.data ?? []) as Signal[]).filter((s) => !dismissed.has(s.id));
}

export async function dbPriorityViews(): Promise<PriorityView[]> {
  const sb = await supabaseServer();
  const week = currentIsoWeek();
  const prevWeek = isoWeekShift(week, -1);
  const weeks = Array.from({ length: 6 }, (_, i) => isoWeekShift(week, -i));

  const [prioritiesQ, movesQ, pulsesQ] = await Promise.all([
    sb.from("priorities").select("*").is("retired_at", null),
    sb.from("moves").select("*").in("iso_week", weeks),
    sb.from("pulses").select("*").in("iso_week", [week, prevWeek]),
  ]);

  const priorities = (prioritiesQ.data ?? []) as (Priority & {
    blocker: string | null;
    blocker_owner_seat: SeatId | null;
  })[];
  const blockers: Record<string, { text: string; owner: SeatId } | undefined> = {};
  for (const p of priorities) {
    if (p.blocker) {
      blockers[p.id] = { text: p.blocker, owner: p.blocker_owner_seat ?? p.sponsor_seat };
    }
  }

  return derivePriorityViews(
    priorities,
    (movesQ.data ?? []) as Move[],
    (pulsesQ.data ?? []) as Pulse[],
    week,
    prevWeek,
    blockers,
  );
}

export async function dbTable(): Promise<TableData> {
  const sb = await supabaseServer();
  const week = currentIsoWeek();
  const day = todayISO();

  const [prioritiesQ, pulsesQ, decisionsQ, receiptsQ] = await Promise.all([
    sb.from("priorities").select("*").is("retired_at", null),
    sb.from("pulses").select("*").in("iso_week", [week, isoWeekShift(week, -1)]),
    sb
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
    sb
      .from("receipts")
      .select("*")
      .in("artifact_id", [day, week]),
  ]);

  const pulses = (pulsesQ.data ?? []) as Pulse[];
  const hasThisWeek = pulses.some((p) => p.iso_week === week);
  const plotWeek = hasThisWeek ? week : isoWeekShift(week, -1);

  const receiptRows = receiptsQ.data ?? [];
  const receipts = SEAT_IDS.map((seat) => ({
    seat,
    brief: receiptRows.some(
      (r) => r.seat === seat && r.artifact_type === "brief" && r.artifact_id === day,
    ),
    pulse: receiptRows.some(
      (r) => r.seat === seat && r.artifact_type === "pulse" && r.artifact_id === week,
    ),
  }));

  return deriveTable(
    (prioritiesQ.data ?? []) as Priority[],
    pulses,
    (decisionsQ.data ?? []) as Decision[],
    receipts,
    plotWeek,
    week,
  );
}

export async function dbLedger(): Promise<LedgerData> {
  const sb = await supabaseServer();
  const [assumptionsQ, evidenceQ] = await Promise.all([
    sb.from("assumptions").select("*").is("retired_at", null),
    sb
      .from("assumption_evidence")
      .select("*, signals(headline, cluster, day)")
      .order("created_at", { ascending: false }),
  ]);

  const evidence = evidenceQ.data ?? [];
  return {
    assumptions: (assumptionsQ.data ?? []).map((a) => ({
      id: a.id,
      statement: a.statement,
      rationale: a.rationale,
      sponsor_seat: a.sponsor_seat,
      confidence: Number(a.confidence),
      status: a.status,
      kind: a.kind ?? "assumption",
      created_at: a.created_at,
      history: a.history ?? [],
      delta30: 0,
      evidence: evidence
        .filter((e) => e.assumption_id === a.id)
        .slice(0, 5)
        .map((e) => {
          const sig = e.signals as unknown as {
            headline: string;
            cluster: { source: string; url: string }[];
            day: string;
          } | null;
          return {
            direction: e.direction as -1 | 1,
            weight: e.weight as 1 | 2 | 3,
            headline: sig?.headline ?? "",
            source: sig?.cluster?.[0]?.source ?? "",
            url: sig?.cluster?.[0]?.url ?? "",
            day: sig?.day ?? "",
          };
        }),
    })),
  };
}

export async function dbDecisionLog(): Promise<Decision[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  return (data ?? []) as Decision[];
}
