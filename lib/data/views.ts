/* View models: what each room needs, shaped once. */

import type {
  Assumption,
  Decision,
  FocusItem,
  Move,
  Priority,
  Signal,
} from "@/lib/types";
import type { SeatId } from "@/lib/seats";

export interface BriefLineRef {
  line: number;
  refs: string[];
}

export interface BriefView {
  day: string;
  script: string;
  audioPath: string | null;
  released: boolean;
  lineRefs: BriefLineRef[];
  refLabels: Record<string, { label: string; url: string | null }>;
}

export interface OperatorReview {
  day: string;
  kind: "morning" | "close";
  script: string;
  windowOpen: boolean;
  releaseAt: string;
}

export interface WeekMoveDot {
  priorityId: string;
  priorityName: string;
  state: Move["state"] | "none";
}

export interface TodayData {
  brief: BriefView | null;
  focus: FocusItem | null;
  topSignals: Signal[];
  weekMoves: WeekMoveDot[];
  review: OperatorReview | null;
  demo: boolean;
}

export interface PriorityView extends Priority {
  move: Move | null;
  blocker: string | null;
  blockerOwner: SeatId | null;
  confidenceDelta: number | null;
  history: Move[];
  threads: LinkedThread[];
}

export interface LinkedThread {
  id: string;
  name: string;
  org: string;
  seatOwner: SeatId;
  status: string;
  nextTouchDate: string | null;
  nextTouchNote: string | null;
}

export interface VoteView {
  seat: SeatId;
  confidence: number;
}

export interface PlotPoint {
  priorityId: string;
  name: string;
  mean: number;
  spread: number;
  votes: VoteView[];
}

export interface WidestSplit {
  priorityName: string;
  highSeat: SeatId;
  highVal: number;
  lowSeat: SeatId;
  lowVal: number;
}

export interface ReceiptRow {
  seat: SeatId;
  brief: boolean;
  pulse: boolean;
}

/* Per-decision receipts: who has viewed it, who concurred, who left feedback.
   Keyed by decision id. Signing off implies having seen it. */
export interface DecisionReceipt {
  seen: SeatId[];
  concurred: SeatId[];
  feedback: { seat: SeatId; note: string | null }[];
}

export interface TableData {
  plot: PlotPoint[];
  widestSplit: WidestSplit | null;
  decisions: Decision[];
  receipts: ReceiptRow[];
  decisionReceipts: Record<string, DecisionReceipt>;
  isoWeek: string;
  votedThisWeek: SeatId[];
}

export interface SeatReaction {
  sentiment: 1 | -1;
  tags: string[];
}

export interface DeckView {
  signals: Signal[];
  /* This seat's saved reaction per signal id, to hydrate the cards. */
  reactions: Record<string, SeatReaction>;
  /* What the app has learned this seat leans into and waves off. */
  topLanes: number[];
  mutedLanes: number[];
}

export interface EvidenceView {
  direction: -1 | 1;
  weight: 1 | 2 | 3;
  headline: string;
  source: string;
  url: string;
  day: string;
}

export interface AssumptionView extends Assumption {
  evidence: EvidenceView[];
  delta30: number;
  myReaction?: SeatReaction | null;
}

export interface RetroView {
  lines: string[];
  missedUrl: string | null;
}

export interface LedgerData {
  assumptions: AssumptionView[];
  retro: RetroView | null;
}
