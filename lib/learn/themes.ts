/* The team knowledge graph, computed. Recent signals are clustered by meaning
   (embedding proximity) into themes — the shape of what the market is doing.
   Each theme is scored for importance (member scores plus the table's net
   reactions) and consensus (how much the four seats agree, from their
   reactions). Runs in the weekly loop; writes with the service role. */

import "server-only";
import { cosine, centroid } from "@/lib/intel/llm";
import type { LaneId } from "@/lib/copy/lanes";

const LOOKBACK_MS = 60 * 86400000;
const JOIN_THRESHOLD = 0.8; // cosine similarity to join an existing theme
const MAX_THEMES = 14;

interface SignalRow {
  id: string;
  lane: number;
  headline: string;
  score: number;
  embedding: number[] | null;
  day: string;
}

interface Cluster {
  centroid: number[];
  members: SignalRow[];
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? (raw as number[]) : null;
}

function label(members: SignalRow[]): string {
  const top = [...members].sort((a, b) => b.score - a.score)[0];
  const words = top.headline.split(/\s+/);
  return words.length > 9 ? `${words.slice(0, 9).join(" ")}…` : top.headline;
}

function modalLane(members: SignalRow[]): number {
  const counts: Record<number, number> = {};
  for (const m of members) counts[m.lane] = (counts[m.lane] ?? 0) + 1;
  return Number(
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? members[0].lane,
  );
}

/* How fast a theme is building, from the spread of its members' days across the
   window. Recent half minus older half, normalized to -1..1: near +1 means most
   of the theme landed lately (an emerging trend), near -1 means it is fading.
   Derived within this run, so no snapshot history is needed. */
function accelerationOf(members: SignalRow[], midpointDay: string): number {
  let recent = 0;
  let older = 0;
  for (const m of members) (m.day >= midpointDay ? recent++ : older++);
  const total = recent + older;
  return total === 0 ? 0 : Math.round(((recent - older) / total) * 100) / 100;
}

/* Agreement across seats on a theme's member signals, 0..1. Null when fewer
   than two seats have reacted — not enough to call. */
function consensusOf(
  memberIds: Set<string>,
  reactions: { subject_id: string; seat: number; sentiment: number }[],
): number | null {
  const bySeat: Record<number, { sum: number; n: number }> = {};
  for (const r of reactions) {
    if (!memberIds.has(r.subject_id)) continue;
    const s = (bySeat[r.seat] ??= { sum: 0, n: 0 });
    s.sum += r.sentiment;
    s.n += 1;
  }
  const means = Object.values(bySeat).map((s) => s.sum / s.n);
  if (means.length < 2) return null;
  const range = Math.max(...means) - Math.min(...means); // 0..2
  return Math.max(0, Math.min(1, 1 - range / 2));
}

export async function computeThemes(): Promise<{ count: number }> {
  const { supabaseService } = await import("@/lib/supabase/service");
  const svc = supabaseService();

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString().slice(0, 10);
  /* The window's midpoint splits recent members from older ones for acceleration. */
  const midpoint = new Date(Date.now() - LOOKBACK_MS / 2).toISOString().slice(0, 10);
  const { data: sigRows } = await svc
    .from("signals")
    .select("id, lane, headline, score, embedding, day")
    .gte("day", since)
    .order("score", { ascending: false })
    .limit(300);

  const signals: SignalRow[] = (sigRows ?? [])
    .map((s) => ({
      id: s.id as string,
      lane: s.lane as number,
      headline: s.headline as string,
      score: Number(s.score),
      embedding: parseEmbedding(s.embedding),
      day: s.day as string,
    }))
    .filter((s) => s.embedding && s.embedding.length > 0);

  if (signals.length === 0) return { count: 0 };

  /* Greedy online clustering: each signal joins the nearest theme above the
     threshold, else opens a new one. Processing highest-score first makes the
     strongest signal the natural anchor and label of its theme. */
  const clusters: Cluster[] = [];
  for (const s of signals) {
    let best: { cluster: Cluster; sim: number } | null = null;
    for (const cluster of clusters) {
      const sim = cosine(s.embedding!, cluster.centroid);
      if (sim >= JOIN_THRESHOLD && (!best || sim > best.sim)) {
        best = { cluster, sim };
      }
    }
    if (best) {
      best.cluster.members.push(s);
      const c = centroid(best.cluster.members.map((m) => m.embedding!));
      if (c) best.cluster.centroid = c;
    } else {
      clusters.push({ centroid: s.embedding!, members: [s] });
    }
  }

  const { data: reactionRows } = await svc
    .from("reactions")
    .select("subject_id, seat, sentiment")
    .eq("subject_type", "signal");
  const reactions = (reactionRows ?? []) as {
    subject_id: string;
    seat: number;
    sentiment: number;
  }[];
  const netBySignal: Record<string, number> = {};
  for (const r of reactions) {
    netBySignal[r.subject_id] = (netBySignal[r.subject_id] ?? 0) + r.sentiment;
  }

  const themes = clusters
    .filter((c) => c.members.length >= 2)
    .map((c) => {
      const memberIds = c.members.map((m) => m.id);
      const idSet = new Set(memberIds);
      const scoreSum = c.members.reduce((a, m) => a + m.score, 0);
      const reactionNet = c.members.reduce(
        (a, m) => a + (netBySignal[m.id] ?? 0),
        0,
      );
      return {
        label: label(c.members),
        lane: modalLane(c.members) as LaneId,
        centroid: c.centroid,
        importance: Math.round((scoreSum + reactionNet * 3) * 10) / 10,
        consensus: consensusOf(idSet, reactions),
        acceleration: accelerationOf(c.members, midpoint),
        member_ids: memberIds,
        member_count: c.members.length,
      };
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, MAX_THEMES);

  /* Replace the theme map wholesale — themes are a derived snapshot. */
  await svc.from("themes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (themes.length > 0) {
    await svc.from("themes").insert(
      themes.map((t) => ({
        label: t.label,
        lane: t.lane,
        centroid: t.centroid,
        importance: t.importance,
        consensus: t.consensus,
        acceleration: t.acceleration,
        member_ids: t.member_ids,
        member_count: t.member_count,
        updated_at: new Date().toISOString(),
      })),
    );
  }

  return { count: themes.length };
}
