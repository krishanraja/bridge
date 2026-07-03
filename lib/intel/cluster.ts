/* Cluster: near duplicate headlines across sources become one candidate.
   Distinct source count is the corroboration signal, and the quality lever. */

import type { Cluster, RawItem } from "./types";

const STOP = new Set(
  "a an the and or of to in on for with as at by from is are was were be its it this that after over amid".split(" "),
);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function cluster(items: RawItem[]): Cluster[] {
  const clusters: { toks: Set<string>; items: RawItem[] }[] = [];

  for (const item of items) {
    const toks = tokens(item.title);
    let placed = false;
    for (const c of clusters) {
      if (similarity(toks, c.toks) >= 0.55) {
        c.items.push(item);
        for (const t of toks) c.toks.add(t);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ toks, items: [item] });
  }

  return clusters.map((c) => {
    const domains = new Set(c.items.map((i) => i.source.toLowerCase()));
    const laneVotes = new Map<number, number>();
    for (const i of c.items) {
      if (i.laneHint) laneVotes.set(i.laneHint, (laneVotes.get(i.laneHint) ?? 0) + 1);
    }
    const laneHint =
      laneVotes.size > 0
        ? ([...laneVotes.entries()].sort((a, b) => b[1] - a[1])[0][0] as Cluster["laneHint"])
        : null;
    const newestAt = Math.max(
      ...c.items.map((i) =>
        i.published_at ? new Date(i.published_at).getTime() : Date.now() - 24 * 3600 * 1000,
      ),
    );
    return {
      items: c.items.slice(0, 5),
      corroboration: domains.size,
      laneHint,
      newestAt,
    };
  });
}
