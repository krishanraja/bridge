import type { LaneId } from "@/lib/copy/lanes";

export interface RawItem {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  snippet: string;
  laneHint: LaneId | null;
  tier: number;
  weight: number;
  engagement: number;
}

export interface Cluster {
  items: RawItem[];
  corroboration: number;
  laneHint: LaneId | null;
  newestAt: number;
}

export interface FilteredCluster extends Cluster {
  lane: LaneId;
  reason: string;
  /* 'act' is a same-day move for the deck; 'shift' is a durable structural
     change routed to the ledger and themes, never the scarce deck. */
  tag: "act" | "shift";
}

export interface ScoredCluster extends FilteredCluster {
  score: number;
  parts: Record<string, number>;
  embedding: number[] | null;
}

export interface CardDraft {
  headline: string;
  for_amperity: string;
  posture: string | null;
  assumption_id: string | null;
  assumption_direction: -1 | 0 | 1;
  assumption_weight: 1 | 2 | 3;
  lowConfidence: boolean;
}

export interface SourceRow {
  id: number;
  name: string;
  kind: string;
  url: string;
  lane: number | null;
  tier: number;
  weight: number;
  active: boolean;
}
