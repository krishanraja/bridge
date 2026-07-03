/* The daily run: gather, cluster, filter, score, synthesize, balance, write.
   At most twelve corroborated cards a day, every one carrying its sources. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";
import type { LaneId } from "@/lib/copy/lanes";
import { LANE_IDS } from "@/lib/copy/lanes";
import { gather } from "./gather";
import { cluster } from "./cluster";
import { filterCandidates } from "./filter";
import { buildCentroids, scoreClusters } from "./score";
import { synthesizeCard, type AssumptionRef } from "./synthesize";
import { balance, mergeTensions, type FinishedCard } from "./balance";
import { applyEvidence, nextStatus } from "@/lib/ledger/confidence";
import type { SourceRow } from "./types";

export interface RunSummary {
  gathered: number;
  clustered: number;
  filtered: number;
  written: number;
  tensions: number;
  redFlags: number;
  day: string;
  notes: string[];
}

export async function runPipeline(): Promise<RunSummary> {
  const sb = supabaseService();
  const day = new Date().toISOString().slice(0, 10);
  const notes: string[] = [];

  const [{ data: sourceRows }, { data: assumptionRows }] = await Promise.all([
    sb.from("sources").select("*").eq("active", true),
    sb.from("assumptions").select("id, statement, confidence, status, history").is("retired_at", null),
  ]);
  const sources = (sourceRows ?? []) as SourceRow[];
  const assumptions = (assumptionRows ?? []) as {
    id: string;
    statement: string;
    confidence: number;
    status: string;
    history: { day: string; confidence: number }[];
  }[];
  const houseView = assumptions.map((a) => a.statement);
  const assumptionRefs: AssumptionRef[] = assumptions.map((a) => ({
    id: a.id,
    statement: a.statement,
  }));

  /* Idempotence: a rerun for the same day replaces the day's deck. */
  await sb.from("signals").delete().eq("day", day).eq("illustrative", false);

  const raw = await gather(sources);
  const clusters = cluster(raw);
  const kept = await filterCandidates(clusters, houseView, notes);
  notes.push(`filter kept ${kept.length} of ${Math.min(clusters.length, 48)}`);

  /* Resonance centroids from the last 30 days of verdicts. */
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: verdicts } = await sb
    .from("events")
    .select("type, subject_id")
    .in("type", ["signal_act", "signal_kill"])
    .gte("created_at", since);
  const actedIds = (verdicts ?? []).filter((v) => v.type === "signal_act").map((v) => v.subject_id);
  const killedIds = (verdicts ?? []).filter((v) => v.type === "signal_kill").map((v) => v.subject_id);
  const fetchEmbeddings = async (ids: string[]) => {
    if (ids.length === 0) return [] as number[][];
    const { data } = await sb.from("signals").select("embedding").in("id", ids).not("embedding", "is", null);
    return (data ?? [])
      .map((r) => (typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding))
      .filter(Boolean) as number[][];
  };
  const centroids = buildCentroids(
    await fetchEmbeddings(actedIds),
    await fetchEmbeddings(killedIds),
  );

  const scored = await scoreClusters(kept, centroids);

  /* Synthesize the top survivors in parallel. */
  const top = scored.slice(0, 16);
  const drafts = await Promise.all(top.map((c) => synthesizeCard(c, assumptionRefs)));
  let cards: FinishedCard[] = top.flatMap((c, i) =>
    drafts[i] ? [{ cluster: c, draft: drafts[i]! }] : [],
  );

  /* Cited or silent: a card without a source URL does not render. */
  cards = cards.filter((c) => c.cluster.items.length > 0 && c.cluster.items[0].url);

  cards = mergeTensions(cards);
  const tensions = cards.filter((c) => c.draft.headline.startsWith("The market is arguing")).length;

  /* Lanes quiet for five days get a seat at the table if anything cleared. */
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const { data: recentLanes } = await sb
    .from("signals")
    .select("lane")
    .gte("day", fiveDaysAgo);
  const activeLanes = new Set((recentLanes ?? []).map((r) => r.lane));
  const quietLanes = LANE_IDS.filter((l) => !activeLanes.has(l)) as LaneId[];

  const finalCards = balance(cards, quietLanes);

  /* Write signals, evidence, ledger updates, and the red flag check. */
  let redFlags = 0;
  for (const card of finalCards) {
    const { data: sig, error } = await sb
      .from("signals")
      .insert({
        day,
        lane: card.cluster.lane,
        headline: card.draft.headline,
        for_amperity: card.draft.for_amperity,
        posture: card.draft.posture,
        score: card.cluster.score,
        corroboration: card.cluster.corroboration,
        cluster: card.cluster.items.map((i) => ({
          title: i.title,
          url: i.url,
          source: i.source,
          published_at: i.published_at,
        })),
        embedding: card.cluster.embedding ? JSON.stringify(card.cluster.embedding) : null,
        assumption_id: card.draft.assumption_id,
        assumption_direction: card.draft.assumption_direction,
        illustrative: false,
      })
      .select("id")
      .single();
    if (error || !sig) {
      notes.push(`write failed: ${error?.message}`);
      continue;
    }

    if (card.draft.assumption_id && card.draft.assumption_direction !== 0) {
      const direction = card.draft.assumption_direction as -1 | 1;
      const weight = card.draft.assumption_weight;
      await sb.from("assumption_evidence").insert({
        assumption_id: card.draft.assumption_id,
        signal_id: sig.id,
        direction,
        weight,
      });

      const a = assumptions.find((x) => x.id === card.draft.assumption_id);
      if (a) {
        const prev = Number(a.confidence);
        const next = applyEvidence(prev, direction, weight);
        const cutoff14 = new Date(Date.now() - 14 * 86400000).toISOString();
        const { count: heavy } = await sb
          .from("assumption_evidence")
          .select("id", { count: "exact", head: true })
          .eq("assumption_id", a.id)
          .eq("direction", -1)
          .eq("weight", 3)
          .gte("created_at", cutoff14);
        const history = [...(a.history ?? []), { day, confidence: Math.round(next) }].slice(-120);
        const cut14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        const old = history.find((h) => h.day >= cut14) ?? history[0];
        const status = nextStatus({
          prev,
          next,
          status: a.status,
          heavyChallenges14d: heavy ?? 0,
          delta14d: next - (old?.confidence ?? next),
        });
        await sb
          .from("assumptions")
          .update({ confidence: next, status, history })
          .eq("id", a.id);
        a.confidence = next;
        a.history = history;
        a.status = status;

        /* Interrupt grade: corroborated challenge on a load bearing belief. */
        if (
          direction === -1 &&
          card.cluster.corroboration >= 3 &&
          card.cluster.score >= 12 &&
          prev >= 60
        ) {
          redFlags++;
          await sb.from("events").insert({
            seat: null,
            type: "red_flag",
            subject_type: "signal",
            subject_id: sig.id,
            value: { assumption_id: a.id, day },
          });
        }
      }
    }
  }

  return {
    gathered: raw.length,
    clustered: clusters.length,
    filtered: kept.length,
    written: finalCards.length,
    tensions,
    redFlags,
    day,
    notes,
  };
}
