/* Score: corroboration dominates, then reputation, freshness, engagement, and
   the learned resonance term from what the seats acted on and killed. */

import "server-only";
import { centroid, cosine, embed } from "./llm";
import type { FilteredCluster, ScoredCluster } from "./types";
import { DEFAULT_WEIGHTS, type ScoreWeights } from "./weights";

export interface ResonanceCentroids {
  acted: number[] | null;
  killed: number[] | null;
}

/* The table's collective taste per lane, net sentiment in ~[-1, 1], learned
   from every seat's reactions. Empty means neutral. */
export type LaneAppetite = Record<number, number>;

export function scoreParts(
  c: FilteredCluster,
  embedding: number[] | null,
  centroids: ResonanceCentroids,
  appetite: LaneAppetite = {},
  w: ScoreWeights = DEFAULT_WEIGHTS,
) {
  const corroboration = Math.min(c.corroboration, 4) * w.corroboration;
  const bestTier = Math.max(...c.items.map((i) => i.tier));
  const avgWeight =
    c.items.reduce((s, i) => s + i.weight, 0) / Math.max(c.items.length, 1);
  const reputation = bestTier * w.reputation * avgWeight;
  const ageHours = Math.max(0, (Date.now() - c.newestAt) / 3600000);
  const freshness = w.freshness * Math.max(0, 1 - ageHours / w.freshnessHalfLifeH);
  const engagement = Math.max(...c.items.map((i) => i.engagement), 0);
  let resonance = 0;
  if (embedding) {
    if (centroids.acted) resonance += w.resonance * cosine(embedding, centroids.acted);
    if (centroids.killed) resonance -= w.resonance * cosine(embedding, centroids.killed);
  }
  /* Self-healing term: the table's collective appetite for this lane, learned
     from reactions, nudges the story up or down. Bounded by teamAppetite. */
  const teamTaste = (appetite[c.lane] ?? 0) * w.teamAppetite;
  const parts = {
    corroboration,
    reputation,
    freshness,
    engagement,
    resonance,
    teamTaste,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, score: Math.round(score * 10) / 10 };
}

export async function scoreClusters(
  clusters: FilteredCluster[],
  centroids: ResonanceCentroids,
  appetite: LaneAppetite = {},
): Promise<ScoredCluster[]> {
  const texts = clusters.map(
    (c) => `${c.items[0].title}. ${c.items[0].snippet}`.slice(0, 500),
  );
  let embeddings: (number[] | null)[] = clusters.map(() => null);
  try {
    embeddings = await embed(texts);
  } catch {
    /* score without resonance rather than fail the run */
  }

  return clusters
    .map((c, i) => {
      const { parts, score } = scoreParts(c, embeddings[i], centroids, appetite);
      return { ...c, score, parts, embedding: embeddings[i] };
    })
    .sort((a, b) => b.score - a.score);
}

/* Centroids from the seats' recent verdicts: what they acted on pulls scores
   up; what they killed pushes them down. Recomputed weekly at G5; live here. */
export function buildCentroids(
  actedEmbeddings: number[][],
  killedEmbeddings: number[][],
): ResonanceCentroids {
  return {
    acted: centroid(actedEmbeddings),
    killed: centroid(killedEmbeddings),
  };
}
