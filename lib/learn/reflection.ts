/* What the app has learned, made legible. Turns the raw reactions into a short
   readout: what this leader leans into, what the table collectively rates, and
   the reasons that come up most. This is the "it's listening" surface. */

import { computeAffinity, type SeatAffinity } from "./affinity";
import { LANE_IDS, type LaneId } from "@/lib/copy/lanes";
import { reasonLabel } from "@/lib/copy/reasons";
import { SEAT_IDS, type SeatId } from "@/lib/seats";

export interface ReactionRowLite {
  seat: number;
  sentiment: number;
  lane: number | null;
  reason_tags: string[] | null;
}

export interface TableLearning {
  teamLikes: LaneId[];
  teamCools: LaneId[];
  myTop: LaneId[];
  myMuted: LaneId[];
  topReasons: { tag: string; label: string; count: number }[];
  total: number;
}

export function summarizeReactions(
  rows: ReactionRowLite[],
  seat: number,
): TableLearning {
  const net: Record<number, number> = {};
  for (const r of rows) {
    if (r.lane != null) net[r.lane] = (net[r.lane] ?? 0) + r.sentiment;
  }
  const teamLikes = LANE_IDS.filter((l) => (net[l] ?? 0) > 0)
    .sort((a, b) => (net[b] ?? 0) - (net[a] ?? 0))
    .slice(0, 3);
  const teamCools = LANE_IDS.filter((l) => (net[l] ?? 0) < 0)
    .sort((a, b) => (net[a] ?? 0) - (net[b] ?? 0))
    .slice(0, 3);

  const mine = computeAffinity(
    rows
      .filter((r) => r.seat === seat)
      .map((r) => ({ lane: r.lane, sentiment: r.sentiment })),
  );

  const counts: Record<string, number> = {};
  for (const r of rows) {
    for (const t of r.reason_tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
  }
  const topReasons = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, label: reasonLabel(tag), count }));

  return {
    teamLikes,
    teamCools,
    myTop: mine.topLanes,
    myMuted: mine.mutedLanes,
    topReasons,
    total: rows.length,
  };
}

export interface PreferenceGraphData {
  /* Each seat's lane appetite, plus the whole table's, over the same reactions.
     perLane runs roughly -1..1 per lane; this is the pattern behind each leader
     and behind the group. */
  perSeat: Record<SeatId, SeatAffinity>;
  group: SeatAffinity;
  total: number;
}

export function allSeatsAffinity(rows: ReactionRowLite[]): PreferenceGraphData {
  const perSeat = {} as Record<SeatId, SeatAffinity>;
  for (const seat of SEAT_IDS) {
    perSeat[seat] = computeAffinity(
      rows
        .filter((r) => r.seat === seat)
        .map((r) => ({ lane: r.lane, sentiment: r.sentiment })),
    );
  }
  const group = computeAffinity(
    rows.map((r) => ({ lane: r.lane, sentiment: r.sentiment })),
  );
  return { perSeat, group, total: rows.length };
}
