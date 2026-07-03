/* Filter: one question per candidate, batched. Does this plausibly change what
   Amperity should build, sell, buy, or say. Yes with a reason, or discard. */

import "server-only";
import ontology from "@/supabase/seed/ontology.json";
import type { Cluster, FilteredCluster } from "./types";
import type { LaneId } from "@/lib/copy/lanes";
import { claude, extractJson, MODELS } from "./llm";

function ontologySummary(): string {
  const e = ontology.entities;
  return [
    `Amperity: enterprise customer data platform; identity resolution is the moat; AmpAI is the AI product line.`,
    `Competitors: ${e.competitors.join(", ")}.`,
    `Partner platforms: ${e.partners.join(", ")}.`,
    `Customers and lookalikes: ${e.customers_and_lookalikes.join(", ")}.`,
  ].join("\n");
}

export async function filterCandidates(
  clusters: Cluster[],
  houseView: string[],
  notes?: string[],
): Promise<FilteredCluster[]> {
  /* Corroborated first, newest first, and a hard cap to keep the run fast. */
  const candidates = [...clusters]
    .sort((a, b) => b.corroboration - a.corroboration || b.newestAt - a.newestAt)
    .slice(0, 48);
  if (candidates.length === 0) return [];

  const system = `You are the market filter for Amperity's leadership office.
${ontologySummary()}
House view:
${houseView.map((s) => `- ${s}`).join("\n")}

For each numbered candidate decide: does this plausibly change what Amperity should build, sell, buy, or say. Marketing fluff, product listicles, and generic AI news die here. Assign a lane: 1 identity and the moat, 2 partner platforms, 3 the category (CDP and composable), 4 agentic AI, 5 customers and verticals (retail, travel), 6 capital and consolidation, 7 trust and regulation, 8 talent and org signal.
Reply with ONLY a JSON array: [{"i": number, "keep": boolean, "reason": "12 words max", "lane": 1-8}].`;

  const batches: Cluster[][] = [];
  for (let i = 0; i < candidates.length; i += 24) batches.push(candidates.slice(i, i + 24));

  const kept: FilteredCluster[] = [];
  for (const batch of batches) {
    const user = batch
      .map((c, i) => {
        const head = c.items[0];
        return `${i}. [${c.corroboration} source${c.corroboration === 1 ? "" : "s"}] ${head.title}${head.snippet ? ` :: ${head.snippet.slice(0, 160)}` : ""}`;
      })
      .join("\n");
    try {
      const reply = await claude({ model: MODELS.filter, system, user, maxTokens: 2000 });
      const rows = extractJson<{ i: number; keep: boolean; reason: string; lane: number }[]>(reply);
      for (const r of rows) {
        const c = batch[r.i];
        if (!c || !r.keep) continue;
        const lane = (r.lane >= 1 && r.lane <= 8 ? r.lane : (c.laneHint ?? 3)) as LaneId;
        kept.push({ ...c, lane, reason: r.reason ?? "" });
      }
    } catch (e) {
      /* A failed batch discards its candidates rather than guessing, but the
         failure is reported, never swallowed. */
      notes?.push(`filter batch failed: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return kept;
}
