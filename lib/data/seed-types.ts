/* Shapes of the seed files. One place, shared by the demo reader and the seed scripts. */

export interface AssumptionSeedRow {
  key: string;
  statement: string;
  rationale: string;
  sponsor_seat?: number;
  confidence: number;
  status?: string;
}

export interface AssumptionsSeed {
  assumptions: AssumptionSeedRow[];
  forces: AssumptionSeedRow[];
}

export interface SignalSeed {
  key: string;
  day_offset: number;
  lane: number;
  headline: string;
  for_amperity: string;
  posture: string | null;
  score: number;
  corroboration: number;
  cluster: { title: string; url: string; source: string }[];
  assumption_key: string | null;
  assumption_direction: number | null;
  assumption_weight: number;
}

export interface MoveSeed {
  week_offset: number;
  text: string;
  owner_seat: number;
  state: string;
  outcome_note?: string;
}

export interface PrioritySeed {
  key: string;
  name: string;
  sponsor_seat: number;
  state: string;
  display_order: number;
  blocker: string | null;
  blocker_owner_seat: number | null;
  moves: MoveSeed[];
}

export interface DecisionSeed {
  key: string;
  day_offset: number;
  text: string;
  owner_seat: number;
  due_in_days: number | null;
  state: string;
  logged_by: number;
  logged_via: string;
  transcript: string | null;
}

export interface PulseSeed {
  week_offset: number;
  seat: number;
  priority_key: string;
  confidence: number;
}

export interface BriefSeed {
  day_offset: number;
  kind: string;
  script: string;
}

export interface ThreadSeed {
  key: string;
  name: string;
  org: string;
  seat_owner: number;
  next_touch_in_days: number | null;
  next_touch_note: string | null;
  last_touch_days_ago: number | null;
  status: string;
  linked_priority_key: string | null;
}

export interface ReceiptSeed {
  seat: number;
  brief: boolean;
  pulse: boolean;
}
