/* Synthesize: one card per survivor. Facts come only from the clustered
   snippets; a low confidence read drops the posture line rather than guessing. */

import "server-only";
import { claude, extractJson } from "./llm";
import { BANNED_LIST } from "@/lib/copy/banned";
import { VOICE } from "@/lib/copy/voice";
import type { CardDraft, ScoredCluster } from "./types";

export interface AssumptionRef {
  id: string;
  statement: string;
}

export async function synthesizeCard(
  c: ScoredCluster,
  assumptions: AssumptionRef[],
  notes?: string[],
): Promise<CardDraft | null> {
  const system = `${VOICE}

You are writing a short market card for Amperity's four leaders. Amperity is the enterprise customer data platform whose moat is identity resolution; AmpAI is its AI product line.
Use ONLY facts present in the provided items; invent nothing, not even plausible detail. No em dashes. Do not use any of these words: ${BANNED_LIST}.
House beliefs:
${assumptions.map((a) => `${a.id} :: ${a.statement}`).join("\n")}

Read against the house, not for it. Your job is to protect the table from confirmation bias, so weigh the threatening reading before the flattering one. Many developments that look like validation are actually threats: if this could commoditize identity resolution, turn the moat into a feature a partner or competitor bundles for free, empower a partner-turned-rival, shift budget away, or make the belief less true, set direction -1 even when the surface reading is positive. Only set direction 1 when the development genuinely strengthens the belief with no material threat underneath. Do not default to 1; a healthy deck carries real counter-signal. When direction is -1, for_amperity must name the threat plainly.

Reply with ONLY JSON:
{
 "headline": "plain, human headline, 90 chars max",
 "for_amperity": "one sentence on why this matters to Amperity specifically, never generic; if direction is -1, name the threat plainly",
 "posture": "one gentle sentence offering what the team might consider doing, framed as a suggestion not an order",
 "assumption": {"id": "id from the list or null", "direction": -1 | 0 | 1, "weight": 1 | 2 | 3},
 "confidence": "high" | "low"
}
direction 1 supports the belief, -1 challenges or threatens it, 0 neutral. weight: 1 light, 2 material, 3 heavy. confidence low means the for_amperity read is a stretch.`;

  const user = c.items
    .map((i) => `- ${i.title} (${i.source})${i.snippet ? ` :: ${i.snippet}` : ""}`)
    .join("\n");

  try {
    const reply = await claude({ system, user, maxTokens: 500 });
    const draft = extractJson<{
      headline: string;
      for_amperity: string;
      posture: string;
      assumption: { id: string | null; direction: number; weight: number };
      confidence: string;
    }>(reply);

    if (!draft.headline || !draft.for_amperity) return null;
    const low = draft.confidence === "low";
    const validAssumption = assumptions.find((a) => a.id === draft.assumption?.id);
    return {
      headline: draft.headline.slice(0, 90),
      for_amperity: draft.for_amperity,
      posture: low ? null : draft.posture || null,
      assumption_id: validAssumption?.id ?? null,
      assumption_direction: (validAssumption
        ? Math.max(-1, Math.min(1, draft.assumption.direction))
        : 0) as -1 | 0 | 1,
      assumption_weight: (validAssumption
        ? Math.max(1, Math.min(3, draft.assumption.weight || 1))
        : 1) as 1 | 2 | 3,
      lowConfidence: low,
    };
  } catch (e) {
    notes?.push(`synthesis dropped a card: ${(e as Error).message.slice(0, 120)}`);
    return null;
  }
}
