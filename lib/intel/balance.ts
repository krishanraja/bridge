/* Balance: scarcity is the product. Twelve cards, three per lane, one card from
   a lane that has been quiet, and contradictions paired into tension cards. */

import type { LaneId } from "@/lib/copy/lanes";
import type { CardDraft, ScoredCluster } from "./types";

export interface FinishedCard {
  cluster: ScoredCluster;
  draft: CardDraft;
}

export function balance(
  cards: FinishedCard[],
  quietLanes: LaneId[],
  cap = 12,
  perLane = 3,
): FinishedCard[] {
  const sorted = [...cards].sort((a, b) => b.cluster.score - a.cluster.score);
  const picked: FinishedCard[] = [];
  const laneCount = new Map<number, number>();

  for (const card of sorted) {
    if (picked.length >= cap) break;
    const lane = card.cluster.lane;
    if ((laneCount.get(lane) ?? 0) >= perLane) continue;
    picked.push(card);
    laneCount.set(lane, (laneCount.get(lane) ?? 0) + 1);
  }

  /* Tunnel vision guard: if a quiet lane cleared filter but missed the cut,
     swap its best card in for the weakest overrepresented pick. */
  for (const quiet of quietLanes) {
    if (picked.some((c) => c.cluster.lane === quiet)) continue;
    const candidate = sorted.find((c) => c.cluster.lane === quiet);
    if (!candidate) continue;
    if (picked.length < cap) {
      picked.push(candidate);
      continue;
    }
    const evictable = [...picked]
      .reverse()
      .find((c) => (laneCount.get(c.cluster.lane) ?? 0) > 1);
    if (evictable) {
      picked.splice(picked.indexOf(evictable), 1);
      laneCount.set(evictable.cluster.lane, (laneCount.get(evictable.cluster.lane) ?? 0) - 1);
      picked.push(candidate);
      laneCount.set(quiet, 1);
    }
  }

  /* Counter-signal guarantee: a deck that only flatters the house has failed at
     the radar's core job. If nothing challenging made the cut but a challenge
     cleared the filter, swap the strongest one in for the weakest
     overrepresented pick. */
  const hasChallenge = picked.some((c) => c.draft.assumption_direction === -1);
  if (!hasChallenge) {
    const challenger = sorted.find(
      (c) => c.draft.assumption_direction === -1 && !picked.includes(c),
    );
    if (challenger) {
      if (picked.length < cap) {
        picked.push(challenger);
      } else {
        const evictable = [...picked]
          .reverse()
          .find((c) => (laneCount.get(c.cluster.lane) ?? 0) > 1);
        if (evictable) {
          picked.splice(picked.indexOf(evictable), 1);
          laneCount.set(
            evictable.cluster.lane,
            (laneCount.get(evictable.cluster.lane) ?? 0) - 1,
          );
          picked.push(challenger);
          laneCount.set(
            challenger.cluster.lane,
            (laneCount.get(challenger.cluster.lane) ?? 0) + 1,
          );
        }
      }
    }
  }

  return picked;
}

/* Two same-day cards arguing opposite directions on one assumption become one
   honest tension card showing both sides. */
export function mergeTensions(cards: FinishedCard[]): FinishedCard[] {
  const out: FinishedCard[] = [];
  const used = new Set<number>();

  for (let i = 0; i < cards.length; i++) {
    if (used.has(i)) continue;
    const a = cards[i];
    if (!a.draft.assumption_id || a.draft.assumption_direction === 0) {
      out.push(a);
      continue;
    }
    const j = cards.findIndex(
      (b, idx) =>
        idx > i &&
        !used.has(idx) &&
        b.draft.assumption_id === a.draft.assumption_id &&
        b.draft.assumption_direction !== 0 &&
        b.draft.assumption_direction === -a.draft.assumption_direction,
    );
    if (j === -1) {
      out.push(a);
      continue;
    }
    const b = cards[j];
    used.add(j);
    const [supports, challenges] =
      a.draft.assumption_direction === 1 ? [a, b] : [b, a];
    out.push({
      cluster: {
        ...a.cluster,
        score: Math.max(a.cluster.score, b.cluster.score) + 0.5,
        corroboration: a.cluster.corroboration + b.cluster.corroboration,
        items: [...a.cluster.items, ...b.cluster.items].slice(0, 6),
      },
      draft: {
        headline: `The market is arguing with itself: ${supports.draft.headline.slice(0, 60)}`,
        for_amperity: `Two reads landed the same day. For: ${supports.draft.for_amperity} Against: ${challenges.draft.for_amperity}`,
        posture: "Hold both reads side by side and let the evidence trail decide, not the loudest headline.",
        assumption_id: a.draft.assumption_id,
        assumption_direction: 0,
        assumption_weight: 2,
        lowConfidence: false,
      },
    });
  }
  return out;
}
