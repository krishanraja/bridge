/* The intelligent reason chips. When a leader taps up or down, we offer a
   short, context-aware set of reasons — enough to learn the "why" without
   making feedback a chore. Chips are the taxonomy the knowledge graph is built
   from: each tag is a stable slug the aggregators can count on. */

export type ReactionSubject =
  | "signal"
  | "decision"
  | "brief"
  | "move"
  | "assumption"
  | "theme";

export interface ReasonChip {
  tag: string;
  label: string;
}

interface ReasonSet {
  up: ReasonChip[];
  down: ReasonChip[];
}

/* Per-subject reasons. Kept short: three to five each, the ones a leader would
   actually reach for. Positive reasons teach what to surface more of; negative
   reasons teach what to filter. */
const REASONS: Record<ReactionSubject, ReasonSet> = {
  signal: {
    up: [
      { tag: "on_the_money", label: "On the money" },
      { tag: "affects_our_moat", label: "Affects our moat" },
      { tag: "watch_closely", label: "Watch closely" },
      { tag: "share_with_team", label: "Share with the team" },
    ],
    down: [
      { tag: "not_our_market", label: "Not our market" },
      { tag: "too_speculative", label: "Too speculative" },
      { tag: "already_knew", label: "Already knew this" },
      { tag: "noise", label: "Just noise" },
      { tag: "wrong_framing", label: "Wrong framing" },
    ],
  },
  decision: {
    up: [
      { tag: "strongly_agree", label: "Strongly agree" },
      { tag: "right_owner", label: "Right owner" },
      { tag: "right_timing", label: "Right timing" },
    ],
    down: [
      { tag: "wrong_owner", label: "Wrong owner" },
      { tag: "timing_off", label: "Timing is off" },
      { tag: "need_more_data", label: "Need more data" },
      { tag: "disagree", label: "Disagree with this" },
    ],
  },
  brief: {
    up: [
      { tag: "useful", label: "Useful read" },
      { tag: "right_priorities", label: "Right priorities" },
      { tag: "good_tone", label: "Good tone" },
    ],
    down: [
      { tag: "off_tone", label: "Off tone" },
      { tag: "missed_context", label: "Missed context" },
      { tag: "too_long", label: "Too long" },
      { tag: "not_relevant", label: "Not relevant to me" },
    ],
  },
  move: {
    up: [
      { tag: "right_move", label: "Right move" },
      { tag: "clear_owner", label: "Clear owner" },
    ],
    down: [
      { tag: "unclear", label: "Unclear" },
      { tag: "not_a_priority", label: "Not a priority" },
      { tag: "wrong_owner", label: "Wrong owner" },
    ],
  },
  assumption: {
    up: [
      { tag: "holds", label: "This holds" },
      { tag: "load_bearing", label: "Load-bearing" },
    ],
    down: [
      { tag: "weakening", label: "Weakening" },
      { tag: "never_believed", label: "Never believed it" },
      { tag: "needs_revisit", label: "Needs a revisit" },
    ],
  },
  theme: {
    up: [
      { tag: "important", label: "Important to us" },
      { tag: "watch", label: "Worth watching" },
    ],
    down: [
      { tag: "overrated", label: "Overrated" },
      { tag: "not_us", label: "Not for us" },
    ],
  },
};

export function reasonsFor(
  subject: ReactionSubject,
  sentiment: 1 | -1,
): ReasonChip[] {
  const set = REASONS[subject];
  return sentiment > 0 ? set.up : set.down;
}

/* Human labels for stored tags, for the "what Bridge is learning" readout. */
const LABELS: Record<string, string> = Object.fromEntries(
  Object.values(REASONS).flatMap((s) =>
    [...s.up, ...s.down].map((c) => [c.tag, c.label]),
  ),
);

export function reasonLabel(tag: string): string {
  return LABELS[tag] ?? tag.replace(/_/g, " ");
}
