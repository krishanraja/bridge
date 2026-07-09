/* Shared data shapes. Mirrors migration one (brief section 12). */

import type { LaneId } from "@/lib/copy/lanes";
import type { SeatId } from "@/lib/seats";

export type PriorityState = "driving" | "at_risk" | "blocked" | "won" | "retired";
export type MoveState = "proposed" | "agreed" | "shipped" | "missed";
export type DecisionState = "open" | "done" | "dropped";
export type AssumptionStatus =
  | "holding"
  | "strengthening"
  | "weakening"
  | "flipped"
  | "retired";
export type ThreadStatus = "advancing" | "stalled" | "dormant";

export interface ClusterMember {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
}

export interface Signal {
  id: string;
  day: string;
  lane: LaneId;
  headline: string;
  for_amperity: string;
  posture: string | null;
  score: number;
  corroboration: number;
  cluster: ClusterMember[];
  assumption_id: string | null;
  assumption_direction: -1 | 0 | 1 | null;
  created_at: string;
  illustrative?: boolean;
  /* 'act' is the daily deck; 'shift' is a structural read that only accretes
     evidence onto a Watch item and feeds the themes graph. Defaults to 'act'. */
  channel?: "act" | "shift";
}

export interface Assumption {
  id: string;
  statement: string;
  rationale: string;
  sponsor_seat: SeatId | null;
  confidence: number;
  status: AssumptionStatus;
  kind: "assumption" | "force";
  created_at: string;
  history?: { day: string; confidence: number }[];
}

export interface AssumptionEvidence {
  id: number;
  assumption_id: string;
  signal_id: string;
  direction: -1 | 1;
  weight: 1 | 2 | 3;
  created_at: string;
}

export interface Priority {
  id: string;
  name: string;
  sponsor_seat: SeatId;
  state: PriorityState;
  confidence: number | null;
  display_order: number;
  created_at: string;
  retired_at: string | null;
  illustrative?: boolean;
}

export interface Move {
  id: string;
  priority_id: string;
  iso_week: string;
  text: string;
  owner_seat: SeatId;
  state: MoveState;
  outcome_note: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  text: string;
  owner_seat: SeatId;
  due_date: string | null;
  state: DecisionState;
  logged_by: SeatId;
  logged_via: "voice" | "typed";
  source_ref: Record<string, string> | null;
  transcript: string | null;
  created_at: string;
}

export interface Pulse {
  iso_week: string;
  seat: SeatId;
  priority_id: string;
  confidence: number;
  created_at: string;
}

export interface DecisionSignoff {
  id: number;
  seat: SeatId;
  decision_id: string;
  stance: "concur" | "feedback";
  note: string | null;
  created_at: string;
}

export interface Brief {
  id: string;
  day: string;
  kind: "morning" | "close";
  script: string;
  line_refs: { line: number; refs: string[] }[] | null;
  audio_path: string | null;
  released_at: string | null;
  edited_by_operator: boolean;
}

export interface Receipt {
  seat: SeatId;
  artifact_type: "brief" | "pulse";
  artifact_id: string;
  seen_at: string;
}

export interface Thread {
  id: string;
  name: string;
  org: string;
  seat_owner: SeatId;
  next_touch_date: string | null;
  next_touch_note: string | null;
  last_touch_date: string | null;
  status: ThreadStatus;
  linked_priority_id: string | null;
  created_at: string;
}

/* The one thing Today asks. Derived, not stored. `reason` is Bridge's plain-words
   rationale for why this is the one thing; `lane` tags it when the subject carries
   one (market signals do), so the card can frame it in the viewer's lane. */
export interface FocusItem {
  kind: "decision" | "move" | "signal" | "thread";
  text: string;
  actionLabel: string;
  href: string;
  reason?: string;
  lane?: LaneId;
}
