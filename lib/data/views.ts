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

export interface BriefView {
  day: string;
  script: string;
  audioPath: string | null;
  released: boolean;
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
  demo: boolean;
}

export interface PriorityView extends Priority {
  move: Move | null;
  blocker: string | null;
  blockerOwner: SeatId | null;
  confidenceDelta: number | null;
  history: Move[];
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

export interface TableData {
  plot: PlotPoint[];
  widestSplit: WidestSplit | null;
  decisions: Decision[];
  receipts: ReceiptRow[];
  isoWeek: string;
  votedThisWeek: SeatId[];
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
}

export interface LedgerData {
  assumptions: AssumptionView[];
}
