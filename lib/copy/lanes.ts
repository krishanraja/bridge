/* The eight lanes. Brief section 5.1. Defined once; chips and card edges only. */

import type { IconName } from "@/components/ui/Icon";

export type LaneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Lane {
  id: LaneId;
  name: string;
  glyph: string;
  icon: IconName;
  cssVar: string;
}

export const LANES: Record<LaneId, Lane> = {
  1: { id: 1, name: "Identity and the moat", glyph: "Moat", icon: "moat", cssVar: "--lane-1" },
  2: { id: 2, name: "Partner platforms", glyph: "Platform", icon: "platform", cssVar: "--lane-2" },
  3: { id: 3, name: "The category", glyph: "Category", icon: "category", cssVar: "--lane-3" },
  4: { id: 4, name: "Agentic AI", glyph: "Agentic", icon: "agentic", cssVar: "--lane-4" },
  5: { id: 5, name: "Customers and verticals", glyph: "Vertical", icon: "vertical", cssVar: "--lane-5" },
  6: { id: 6, name: "Capital and consolidation", glyph: "Capital", icon: "capital", cssVar: "--lane-6" },
  7: { id: 7, name: "Trust and regulation", glyph: "Trust", icon: "trust", cssVar: "--lane-7" },
  8: { id: 8, name: "Talent and org signal", glyph: "Talent", icon: "talent", cssVar: "--lane-8" },
};

export const LANE_IDS = Object.keys(LANES).map(Number) as LaneId[];

export function laneColor(id: LaneId): string {
  return `var(${LANES[id].cssVar})`;
}
