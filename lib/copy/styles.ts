/* Per-seat style profiles. A short memo on how each principal likes information
   delivered, seeded by the operator and tuned by the learning loop. The composer
   and the Ask room read it, so the same facts land differently per seat.
   Section 2 of the brief; named by the leadership as what they want from AI. */

import type { SeatId } from "@/lib/seats";

export interface StyleProfile {
  seat: SeatId;
  memo: string;
  laneWeighting: string;
}

export const STYLE_PROFILES: Record<SeatId, StyleProfile> = {
  1: {
    seat: 1,
    memo: "Kabir reads narrative first, numbers second. Open with the market story and the one call that needs his judgment today. Keep it decisive; he moves on a clear verdict, not a hedge.",
    laneWeighting: "the whole board, weighted to the call that needs a Co-CEO",
  },
  2: {
    seat: 2,
    memo: "Derek reads product and platform first. Lead with the identity moat, partner platforms, and agentic shifts. He wants the mechanism, not the vibe: name the specific product move and what it changes for the roadmap.",
    laneWeighting: "identity and the moat, partner platforms, agentic AI",
  },
  3: {
    seat: 3,
    memo: "Amy reads capital and customers first. Lead with consolidation, valuation marks, and named-account signals. She wants the number and the exposure: what it costs, what it protects, what it risks.",
    laneWeighting: "capital and consolidation, customers and verticals, the category",
  },
  4: {
    seat: 4,
    memo: "Krish is the operator and reads everything, ordered by what needs curation before it lands. Surface the drafts, the edits, and the approvals waiting on him.",
    laneWeighting: "everything, ordered by what needs a hand before 07:25",
  },
};
