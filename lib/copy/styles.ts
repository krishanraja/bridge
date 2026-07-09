/* Per-seat style profiles. A short memo on how each principal likes information
   delivered, seeded by the operator and tuned by the learning loop. The composer
   and the Ask room read it, so the same facts land differently per seat.
   Section 2 of the brief; named by the leadership as what they want from AI. */

import type { SeatId } from "@/lib/seats";
import type { LaneId } from "@/lib/copy/lanes";

export interface StyleProfile {
  seat: SeatId;
  memo: string;
  laneWeighting: string;
}

export const STYLE_PROFILES: Record<SeatId, StyleProfile> = {
  1: {
    seat: 1,
    memo: "Kabir likes the story first, then the numbers. Open with what is happening in the market and the one thing that feels like his call today. Clear and warm, not clipped.",
    laneWeighting: "the whole board, weighted to the call that needs a Co-CEO",
  },
  2: {
    seat: 2,
    memo: "Derek cares most about product and platform. Lead with the identity moat, the partner platforms, and where agents are heading. Name the specific move and what it means for the roadmap, in plain terms.",
    laneWeighting: "identity and the moat, partner platforms, agentic AI",
  },
  3: {
    seat: 3,
    memo: "Amy watches capital and customers. Lead with consolidation, valuations, and news from named accounts. Give her the number and what it means for us, gently: what it protects and what to keep an eye on.",
    laneWeighting: "capital and consolidation, customers and verticals, the category",
  },
  4: {
    seat: 4,
    memo: "Krish runs the office and reads everything, ordered by what still needs a hand before it lands. Surface the drafts, the edits, and anything waiting on him.",
    laneWeighting: "everything, ordered by what needs a hand before it lands",
  },
};

/* The lanes each principal owns, and the whole clause the Today hero says when
   the day's one thing lands in one of them, so the focus feels chosen for them.
   Kabir reads the whole board as Co-CEO, so his lanes span it. Krish reads
   everything as the operator, so he claims no single lane. */
const SEAT_LANES: Partial<Record<SeatId, { lanes: LaneId[]; clause: string }>> = {
  1: { lanes: [1, 2, 3, 4, 5, 6, 7, 8], clause: "This is the kind of call a Co-CEO makes." },
  2: { lanes: [1, 2, 4], clause: "This sits in your lane, product and platform." },
  3: { lanes: [3, 5, 6], clause: "This sits in your lane, capital and customers." },
};

/* A short line framing the focus for the viewer, or null when it is not theirs to
   lean into. Pure; safe to call from server or client. */
export function seatFraming(seat: SeatId, lane?: LaneId | null): string | null {
  if (lane == null) return null;
  const owned = SEAT_LANES[seat];
  if (!owned || !owned.lanes.includes(lane)) return null;
  return owned.clause;
}
