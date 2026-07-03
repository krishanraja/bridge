/* Demo data source: reads the seed files and materializes dates relative to now.
   Every row it produces is illustrative and marked as such. */

import assumptionsSeedJson from "@/supabase/seed/assumptions.json";
import signalsSeedJson from "@/supabase/seed/demo/signals.json";
import prioritiesSeedJson from "@/supabase/seed/demo/priorities.json";
import decisionsSeedJson from "@/supabase/seed/demo/decisions.json";
import pulsesSeedJson from "@/supabase/seed/demo/pulses.json";
import briefsSeedJson from "@/supabase/seed/demo/briefs.json";
import threadsSeedJson from "@/supabase/seed/demo/threads.json";
import receiptsSeedJson from "@/supabase/seed/demo/receipts.json";
import historySeedJson from "@/supabase/seed/demo/assumption_history.json";
import type {
  AssumptionsSeed,
  BriefSeed,
  DecisionSeed,
  PrioritySeed,
  PulseSeed,
  ReceiptSeed,
  SignalSeed,
  ThreadSeed,
} from "./seed-types";

const assumptionsSeed = assumptionsSeedJson as AssumptionsSeed;
const signalsSeed = signalsSeedJson as SignalSeed[];
const prioritiesSeed = prioritiesSeedJson as PrioritySeed[];
const decisionsSeed = decisionsSeedJson as DecisionSeed[];
const pulsesSeed = pulsesSeedJson as PulseSeed[];
const briefsSeed = briefsSeedJson as BriefSeed[];
const threadsSeed = threadsSeedJson as ThreadSeed[];
const receiptsSeed = receiptsSeedJson as ReceiptSeed[];
const historySeed = historySeedJson as unknown as Record<string, [number, number][]>;

import type {
  Assumption,
  Decision,
  Move,
  Priority,
  Pulse,
  Signal,
  Thread,
} from "@/lib/types";
import type { LaneId } from "@/lib/copy/lanes";
import type { SeatId } from "@/lib/seats";
import { currentIsoWeek, isoWeekShift } from "@/lib/weeks";
import {
  deriveFocus,
  derivePriorityViews,
  deriveTable,
  topSignals,
  weekMoveDots,
} from "./derive";
import type { LedgerData, TableData, TodayData } from "./views";

function dayISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function ts(offset: number, hour = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/* Raw materialization */

export function demoAssumptions(): Assumption[] {
  const rows = [
    ...assumptionsSeed.assumptions.map((a) => ({ ...a, kind: "assumption" as const })),
    ...assumptionsSeed.forces.map((f) => ({ ...f, kind: "force" as const })),
  ];
  const history = historySeed as Record<string, [number, number][]>;
  return rows.map((a) => ({
    id: a.key,
    statement: a.statement,
    rationale: a.rationale,
    sponsor_seat: (a.sponsor_seat as SeatId | undefined) ?? null,
    confidence: a.confidence,
    status: (a.status ?? "holding") as Assumption["status"],
    kind: a.kind,
    created_at: ts(-90),
    history: (history[a.key] ?? []).map(([off, conf]) => ({
      day: dayISO(off),
      confidence: conf,
    })),
  }));
}

export function demoSignals(): Signal[] {
  return signalsSeed
    .map((s) => ({
      id: s.key,
      day: dayISO(s.day_offset),
      lane: s.lane as LaneId,
      headline: s.headline,
      for_amperity: s.for_amperity,
      posture: s.posture ?? null,
      score: s.score,
      corroboration: s.corroboration,
      cluster: s.cluster.map((c) => ({
        title: c.title,
        url: c.url,
        source: c.source,
        published_at: dayISO(s.day_offset),
      })),
      assumption_id: s.assumption_key ?? null,
      assumption_direction: (s.assumption_direction ??
        null) as Signal["assumption_direction"],
      created_at: ts(s.day_offset, 6),
      illustrative: true,
    }))
    .sort((a, b) => (a.day === b.day ? b.score - a.score : a.day < b.day ? 1 : -1));
}

export function demoPriorities(): {
  priorities: Priority[];
  moves: Move[];
  blockers: Record<string, { text: string; owner: SeatId } | undefined>;
} {
  const priorities: Priority[] = [];
  const moves: Move[] = [];
  const blockers: Record<string, { text: string; owner: SeatId } | undefined> = {};
  const week = currentIsoWeek();

  for (const p of prioritiesSeed) {
    priorities.push({
      id: p.key,
      name: p.name,
      sponsor_seat: p.sponsor_seat as SeatId,
      state: p.state as Priority["state"],
      confidence: null,
      display_order: p.display_order,
      created_at: ts(-30),
      retired_at: null,
      illustrative: true,
    });
    if (p.blocker) {
      blockers[p.key] = {
        text: p.blocker,
        owner: (p.blocker_owner_seat ?? p.sponsor_seat) as SeatId,
      };
    }
    for (const m of p.moves) {
      moves.push({
        id: `${p.key}-w${m.week_offset}`,
        priority_id: p.key,
        iso_week: isoWeekShift(week, m.week_offset),
        text: m.text,
        owner_seat: m.owner_seat as SeatId,
        state: m.state as Move["state"],
        outcome_note: m.outcome_note ?? null,
        created_at: ts(m.week_offset * 7),
      });
    }
  }
  return { priorities, moves, blockers };
}

export function demoDecisions(): Decision[] {
  return decisionsSeed.map((d) => ({
    id: d.key,
    text: d.text,
    owner_seat: d.owner_seat as SeatId,
    due_date: d.due_in_days != null ? dayISO(d.due_in_days) : null,
    state: d.state as Decision["state"],
    logged_by: d.logged_by as SeatId,
    logged_via: d.logged_via as Decision["logged_via"],
    source_ref: null,
    transcript: d.transcript ?? null,
    created_at: ts(d.day_offset, 15),
  }));
}

export function demoPulses(): Pulse[] {
  const week = currentIsoWeek();
  return pulsesSeed.map((p) => ({
    iso_week: isoWeekShift(week, p.week_offset),
    seat: p.seat as SeatId,
    priority_id: p.priority_key,
    confidence: p.confidence,
    created_at: ts(p.week_offset * 7, 8),
  }));
}

export function demoThreads(): Thread[] {
  return threadsSeed.map((t) => ({
    id: t.key,
    name: t.name,
    org: t.org,
    seat_owner: t.seat_owner as SeatId,
    next_touch_date: t.next_touch_in_days != null ? dayISO(t.next_touch_in_days) : null,
    next_touch_note: t.next_touch_note ?? null,
    last_touch_date: t.last_touch_days_ago != null ? dayISO(-t.last_touch_days_ago) : null,
    status: t.status as Thread["status"],
    linked_priority_id: t.linked_priority_key ?? null,
    created_at: ts(-30),
  }));
}

/* Room views */

export async function demoToday(): Promise<TodayData> {
  const signals = demoSignals().filter((s) => s.day === dayISO(0));
  const { priorities, moves } = demoPriorities();
  const decisions = demoDecisions();
  const threads = demoThreads();
  const week = currentIsoWeek();
  const brief = briefsSeed.find((b) => b.day_offset === 0);

  return {
    brief: brief
      ? {
          day: dayISO(0),
          script: brief.script,
          audioPath: null,
          released: true,
        }
      : null,
    focus: deriveFocus({
      decisions,
      priorities,
      moves,
      signals,
      threads,
      todayISO: dayISO(0),
      isoWeek: week,
    }),
    topSignals: topSignals(signals, 3),
    weekMoves: weekMoveDots(priorities, moves, week),
    demo: true,
  };
}

export async function demoDeck(): Promise<Signal[]> {
  const today = dayISO(0);
  return demoSignals()
    .filter((s) => s.day === today)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export async function demoPriorityViews() {
  const { priorities, moves, blockers } = demoPriorities();
  const pulses = demoPulses();
  const week = currentIsoWeek();
  return derivePriorityViews(
    priorities,
    moves,
    pulses,
    week,
    isoWeekShift(week, -1),
    blockers,
  );
}

export async function demoTable(): Promise<TableData> {
  const { priorities } = demoPriorities();
  const pulses = demoPulses();
  const decisions = demoDecisions();
  const week = currentIsoWeek();
  const receipts = receiptsSeed.map((r) => ({
    seat: r.seat as SeatId,
    brief: r.brief,
    pulse: r.pulse,
  }));
  /* Demo pulses vote on last week's Monday when today is early in the week; fall back so the plot always has data. */
  const hasThisWeek = pulses.some((p) => p.iso_week === week);
  const plotWeek = hasThisWeek ? week : isoWeekShift(week, -1);
  return deriveTable(priorities, pulses, decisions, receipts, plotWeek);
}

export async function demoLedger(): Promise<LedgerData> {
  const assumptions = demoAssumptions();
  const signals = demoSignals();
  return {
    assumptions: assumptions.map((a) => {
      const ev = signals
        .filter((s) => s.assumption_id === a.id && s.assumption_direction)
        .slice(0, 5)
        .map((s) => ({
          direction: s.assumption_direction as -1 | 1,
          weight: 2 as const,
          headline: s.headline,
          source: s.cluster[0]?.source ?? "",
          url: s.cluster[0]?.url ?? "",
          day: s.day,
        }));
      const hist = a.history ?? [];
      const past = hist.find((h) => h.day <= dayISO(-30));
      return {
        ...a,
        evidence: ev,
        delta30: past ? Math.round(a.confidence - past.confidence) : 0,
      };
    }),
  };
}

export async function demoDecisionLog(): Promise<Decision[]> {
  return demoDecisions().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
