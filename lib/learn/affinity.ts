/* What each leader cares about, learned from their reactions. A seat's thumbs
   up/down on radar signals accrue per lane into an appetite the deck re-ranks
   by — so over time the radar leads with what that leader actually reads, and
   quiets what they keep waving off. Pure functions; the raw votes come from the
   reactions table. */

import { LANE_IDS, type LaneId } from "@/lib/copy/lanes";

export interface SeatAffinity {
  /* Net signed appetite per lane, roughly in [-1, 1]. */
  perLane: Record<number, number>;
  topLanes: LaneId[];
  mutedLanes: LaneId[];
  /* How much evidence we have, so callers can hold off on thin data. */
  sampleSize: number;
}

export interface LaneVote {
  lane: number | null;
  sentiment: number;
}

export function computeAffinity(votes: LaneVote[]): SeatAffinity {
  const sum: Record<number, number> = {};
  const cnt: Record<number, number> = {};
  let sampleSize = 0;
  for (const v of votes) {
    if (v.lane == null) continue;
    sum[v.lane] = (sum[v.lane] ?? 0) + v.sentiment;
    cnt[v.lane] = (cnt[v.lane] ?? 0) + 1;
    sampleSize++;
  }
  const perLane: Record<number, number> = {};
  for (const lane of LANE_IDS) {
    const c = cnt[lane] ?? 0;
    /* Average sentiment, shrunk toward zero when the sample is thin so one
       stray tap doesn't swing the whole lane. */
    perLane[lane] = c > 0 ? (sum[lane] ?? 0) / (c + 1) : 0;
  }
  const seen = LANE_IDS.filter((l) => (cnt[l] ?? 0) > 0);
  const ranked = [...seen].sort((a, b) => perLane[b] - perLane[a]);
  const topLanes = ranked.filter((l) => perLane[l] > 0.15).slice(0, 3);
  const mutedLanes = ranked
    .filter((l) => perLane[l] < -0.15)
    .sort((a, b) => perLane[a] - perLane[b])
    .slice(0, 3);
  return { perLane, topLanes, mutedLanes, sampleSize };
}

/* Re-rank a scored signal list by a seat's lane appetite. The nudge is bounded
   to a fraction of the top score, so a strong market signal still surfaces even
   in a muted lane — appetite orders the deck, it doesn't censor it. */
export function personalize<T extends { lane: LaneId; score: number }>(
  signals: T[],
  affinity: SeatAffinity,
): T[] {
  if (affinity.sampleSize === 0) return signals;
  const max = Math.max(1, ...signals.map((s) => Number(s.score)));
  return [...signals].sort(
    (a, b) =>
      Number(b.score) + (affinity.perLane[b.lane] ?? 0) * max * 0.35 -
      (Number(a.score) + (affinity.perLane[a.lane] ?? 0) * max * 0.35),
  );
}
