/* Pure derivations from domain rows to view models. Shared by the demo reader and the database source. */

import type {
  Assumption,
  Decision,
  FocusItem,
  Move,
  Priority,
  Pulse,
  Signal,
  Thread,
} from "@/lib/types";
import { SEATS, type SeatId } from "@/lib/seats";
import type {
  PlotPoint,
  PriorityView,
  TableData,
  WeekMoveDot,
  WidestSplit,
} from "./views";

export function topSignals(signals: Signal[], n: number): Signal[] {
  return [...signals].sort((a, b) => b.score - a.score).slice(0, n);
}

export function weekMoveDots(
  priorities: Priority[],
  moves: Move[],
  isoWeek: string,
): WeekMoveDot[] {
  return priorities
    .filter((p) => !p.retired_at)
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => {
      const m = moves.find(
        (mv) => mv.priority_id === p.id && mv.iso_week === isoWeek,
      );
      return {
        priorityId: p.id,
        priorityName: p.name,
        state: m?.state ?? "none",
      };
    });
}

/* The single focus. Precedence: open decision due soonest, then move at risk,
   then red-flag signal, then a thread whose next touch is today. */
export function deriveFocus(args: {
  decisions: Decision[];
  priorities: Priority[];
  moves: Move[];
  signals: Signal[];
  threads: Thread[];
  todayISO: string;
  isoWeek: string;
}): FocusItem | null {
  const { decisions, priorities, moves, signals, threads, todayISO, isoWeek } =
    args;

  const dueThread = threads.find(
    (t) => t.next_touch_date === todayISO && t.status !== "dormant",
  );

  const openDecisions = decisions
    .filter((d) => d.state === "open" && d.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  if (openDecisions.length > 0) {
    const d = openDecisions[0];
    return {
      kind: "decision",
      text: `${d.text} Feels like ${SEATS[d.owner_seat].shortName}'s call, ideally ${formatDue(d.due_date!)}.`,
      actionLabel: "Take a look",
      href: "/table",
    };
  }

  const atRisk = priorities.find((p) => p.state === "at_risk" || p.state === "blocked");
  if (atRisk) {
    const m = moves.find(
      (mv) => mv.priority_id === atRisk.id && mv.iso_week === isoWeek,
    );
    const label = atRisk.state === "blocked" ? "is stuck" : "could use some attention";
    return {
      kind: "move",
      text: m
        ? `${atRisk.name} ${label}. This week the plan is: ${m.text}`
        : `${atRisk.name} ${label}, and there is no move set for it yet.`,
      actionLabel: "Take a look",
      href: "/priorities",
    };
  }

  const redFlag = signals.find((s) => s.assumption_direction === -1 && s.corroboration >= 3);
  if (redFlag) {
    return {
      kind: "signal",
      text: `Worth a look: ${redFlag.headline}`,
      actionLabel: "See the radar",
      href: "/radar",
    };
  }

  if (dueThread) {
    return {
      kind: "thread",
      text: `A good day to reach out to ${dueThread.name} at ${dueThread.org}${dueThread.next_touch_note ? `: ${dueThread.next_touch_note}` : ""}.`,
      actionLabel: "Take a look",
      href: "/priorities",
    };
  }

  return null;
}

export function derivePriorityViews(
  priorities: Priority[],
  moves: Move[],
  pulses: Pulse[],
  isoWeek: string,
  prevIsoWeek: string,
  blockers: Record<string, { text: string; owner: SeatId } | undefined> = {},
  threads: Thread[] = [],
): PriorityView[] {
  return priorities
    .filter((p) => !p.retired_at)
    .sort((a, b) => a.display_order - b.display_order)
    .map((p) => {
      const conf = meanConfidence(pulses, p.id, isoWeek);
      const prev = meanConfidence(pulses, p.id, prevIsoWeek);
      const history = moves
        .filter((m) => m.priority_id === p.id)
        .sort((a, b) => (a.iso_week < b.iso_week ? 1 : -1))
        .slice(0, 6);
      return {
        ...p,
        confidence: conf ?? p.confidence,
        confidenceDelta: conf != null && prev != null ? conf - prev : null,
        move: history.find((m) => m.iso_week === isoWeek) ?? null,
        blocker: blockers[p.id]?.text ?? null,
        blockerOwner: blockers[p.id]?.owner ?? null,
        history,
        threads: threads
          .filter((t) => t.linked_priority_id === p.id)
          .map((t) => ({
            id: t.id,
            name: t.name,
            org: t.org,
            seatOwner: t.seat_owner,
            status: t.status,
            nextTouchDate: t.next_touch_date,
            nextTouchNote: t.next_touch_note,
          })),
      };
    });
}

function meanConfidence(
  pulses: Pulse[],
  priorityId: string,
  isoWeek: string,
): number | null {
  const votes = pulses.filter(
    (pl) => pl.priority_id === priorityId && pl.iso_week === isoWeek,
  );
  if (votes.length === 0) return null;
  return Math.round(votes.reduce((s, v) => s + v.confidence, 0) / votes.length);
}

export function deriveTable(
  priorities: Priority[],
  pulses: Pulse[],
  decisions: Decision[],
  receipts: { seat: SeatId; brief: boolean; pulse: boolean }[],
  isoWeek: string,
  currentWeek?: string,
): TableData {
  const active = priorities
    .filter((p) => !p.retired_at)
    .sort((a, b) => a.display_order - b.display_order);

  const plot: PlotPoint[] = active.map((p) => {
    const votes = pulses
      .filter((pl) => pl.priority_id === p.id && pl.iso_week === isoWeek)
      .map((pl) => ({ seat: pl.seat, confidence: pl.confidence }));
    const mean =
      votes.length > 0
        ? Math.round(votes.reduce((s, v) => s + v.confidence, 0) / votes.length)
        : 0;
    const spread =
      votes.length > 0
        ? Math.max(...votes.map((v) => v.confidence)) -
          Math.min(...votes.map((v) => v.confidence))
        : 0;
    return { priorityId: p.id, name: p.name, mean, spread, votes };
  });

  const voted = plot.filter((pt) => pt.votes.length >= 2);
  let widestSplit: WidestSplit | null = null;
  if (voted.length > 0) {
    const widest = voted.reduce((a, b) => (a.spread >= b.spread ? a : b));
    if (widest.spread > 0) {
      const hi = widest.votes.reduce((a, b) =>
        a.confidence >= b.confidence ? a : b,
      );
      const lo = widest.votes.reduce((a, b) =>
        a.confidence <= b.confidence ? a : b,
      );
      widestSplit = {
        priorityName: widest.name,
        highSeat: hi.seat,
        highVal: hi.confidence,
        lowSeat: lo.seat,
        lowVal: lo.confidence,
      };
    }
  }

  const lastDecisions = [...decisions]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 3);

  const week = currentWeek ?? isoWeek;
  const votedThisWeek = Array.from(
    new Set(pulses.filter((p) => p.iso_week === week).map((p) => p.seat)),
  ) as SeatId[];

  return { plot, widestSplit, decisions: lastDecisions, receipts, isoWeek, votedThisWeek };
}

export function formatDue(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7)
    return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
