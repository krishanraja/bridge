import type { MoveState, PriorityState } from "@/lib/types";

export const PRIORITY_STATE: Record<
  PriorityState,
  { label: string; color: string }
> = {
  driving: { label: "Driving", color: "var(--mint-deep)" },
  at_risk: { label: "At risk", color: "var(--risk)" },
  blocked: { label: "Blocked", color: "var(--risk)" },
  won: { label: "Won", color: "var(--mint)" },
  retired: { label: "Retired", color: "var(--ink-3)" },
};

export const MOVE_STATE: Record<MoveState, { label: string; color: string }> = {
  proposed: { label: "Proposed", color: "var(--ink-3)" },
  agreed: { label: "Agreed", color: "var(--ink-2)" },
  shipped: { label: "Shipped", color: "var(--mint-deep)" },
  missed: { label: "Missed", color: "var(--risk)" },
};
