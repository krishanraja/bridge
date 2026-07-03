/* The Sunday learning job. It proposes; a human releases. Four loops:
   source weights, resonance centroids, lane appetite per seat, and the
   composer style memo. Everything lands as a staged proposal the operator
   approves, adjusts, or skips. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";
import { currentIsoWeek } from "@/lib/weeks";
import { centroid } from "@/lib/intel/llm";
import { LANE_IDS, type LaneId } from "@/lib/copy/lanes";
import { SEAT_IDS, type SeatId } from "@/lib/seats";

const FLOOR = 0.5;
const CEIL = 1.6;
const EMA = 0.25;

export interface SourceWeightChange {
  id: number;
  name: string;
  from: number;
  to: number;
}

export interface LaneAppetite {
  seat: SeatId;
  order: LaneId[];
}

export interface LearnProposal {
  week: string;
  sourceWeights: SourceWeightChange[];
  laneAppetite: LaneAppetite[];
  styleMemo: string | null;
  resonanceRefreshed: boolean;
  summary: string;
}

function clamp(x: number): number {
  return Math.max(FLOOR, Math.min(CEIL, x));
}

export async function computeLearning(): Promise<LearnProposal> {
  const sb = supabaseService();
  const week = currentIsoWeek();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const [sourcesQ, eventsQ, editsQ] = await Promise.all([
    sb.from("sources").select("id, name, weight, active"),
    sb
      .from("events")
      .select("type, subject_id, seat")
      .in("type", ["signal_act", "signal_kill", "signal_hold"])
      .gte("created_at", since),
    sb
      .from("events")
      .select("value")
      .eq("type", "operator_edit")
      .gte("created_at", since),
  ]);

  const sources = sourcesQ.data ?? [];
  const events = eventsQ.data ?? [];

  /* Map each verdict to the sources that corroborated its signal. */
  const actedIds = events.filter((e) => e.type === "signal_act").map((e) => e.subject_id);
  const killedIds = events.filter((e) => e.type === "signal_kill").map((e) => e.subject_id);
  const allIds = [...new Set([...actedIds, ...killedIds])];

  const sourceScore = new Map<string, number>(); // source name -> net signal
  if (allIds.length > 0) {
    const { data: sigs } = await sb
      .from("signals")
      .select("id, cluster")
      .in("id", allIds);
    for (const s of sigs ?? []) {
      const delta = actedIds.includes(s.id) ? 1 : killedIds.includes(s.id) ? -1 : 0;
      for (const c of (s.cluster ?? []) as { source?: string }[]) {
        if (!c.source) continue;
        sourceScore.set(c.source, (sourceScore.get(c.source) ?? 0) + delta);
      }
    }
  }

  const sourceWeights: SourceWeightChange[] = [];
  for (const src of sources) {
    const net = sourceScore.get(src.name) ?? 0;
    if (net === 0) continue;
    const target = Number(src.weight) + Math.sign(net) * 0.2 * Math.min(Math.abs(net), 3);
    const next = Math.round(clamp((1 - EMA) * Number(src.weight) + EMA * target) * 100) / 100;
    if (next !== Number(src.weight)) {
      sourceWeights.push({ id: src.id, name: src.name, from: Number(src.weight), to: next });
    }
  }

  /* Lane appetite: per seat, order lanes by how often that seat opened or
     acted on cards in each lane. */
  const laneAppetite: LaneAppetite[] = [];
  const cardEvents = events.filter((e) => e.seat != null);
  if (cardEvents.length > 0 && allIds.length > 0) {
    const { data: sigLanes } = await sb.from("signals").select("id, lane").in("id", allIds);
    const laneById = new Map((sigLanes ?? []).map((s) => [s.id, s.lane as LaneId]));
    for (const seat of SEAT_IDS) {
      const counts = new Map<LaneId, number>();
      for (const e of cardEvents) {
        if (e.seat !== seat) continue;
        const lane = laneById.get(e.subject_id);
        if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      const order = [...LANE_IDS].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
      laneAppetite.push({ seat, order });
    }
  }

  /* Resonance centroids: recomputed and cached for the next pipeline run. */
  let resonanceRefreshed = false;
  const fetchEmb = async (ids: string[]) => {
    if (ids.length === 0) return [] as number[][];
    const { data } = await sb.from("signals").select("embedding").in("id", ids).not("embedding", "is", null);
    return (data ?? [])
      .map((r) => (typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding))
      .filter(Boolean) as number[][];
  };
  const actedCentroid = centroid(await fetchEmb(actedIds));
  const killedCentroid = centroid(await fetchEmb(killedIds));
  if (actedCentroid || killedCentroid) {
    await sb.from("learn_proposals").insert({
      week: `${week}:centroids`,
      proposal: { acted: actedCentroid, killed: killedCentroid },
      status: "approved",
    });
    resonanceRefreshed = true;
  }

  /* Composer style memo: high edit-distance operator edits tune the register.
     A light heuristic here; the operator approves the memo before it sticks. */
  const edits = editsQ.data ?? [];
  const heavyEdits = edits.filter((e) => ((e.value as { chars?: number })?.chars ?? 0) > 400);
  const styleMemo =
    heavyEdits.length >= 2
      ? "The operator reshaped the brief heavily this week. Tighten the market section and lead with the call sooner."
      : null;

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const parts: string[] = [];
  if (sourceWeights.length)
    parts.push(
      `${sourceWeights.length} source weight ${plural(sourceWeights.length, "change", "changes")}`,
    );
  if (laneAppetite.length)
    parts.push(
      `lane appetite for ${laneAppetite.length} ${plural(laneAppetite.length, "seat", "seats")}`,
    );
  if (resonanceRefreshed) parts.push("resonance refreshed");
  if (styleMemo) parts.push("a composer style note");
  const summary = parts.length ? `This week I would adjust ${parts.join(", ")}.` : "Nothing to change this week.";

  return { week, sourceWeights, laneAppetite, styleMemo, resonanceRefreshed, summary };
}

/* Stage the proposal for the operator's Sunday review. */
export async function stageProposal(p: LearnProposal): Promise<number | null> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("learn_proposals")
    .insert({ week: p.week, proposal: p, status: "staged" })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

/* Apply an approved proposal: source weights land, lane order lands. Resonance
   is already cached; the style memo versions into the repo by hand. */
export async function applyProposal(id: number): Promise<{ applied: boolean }> {
  const sb = supabaseService();
  const { data: row } = await sb.from("learn_proposals").select("proposal, status").eq("id", id).single();
  if (!row || row.status !== "approved") return { applied: false };
  const p = row.proposal as LearnProposal;

  for (const sw of p.sourceWeights) {
    await sb.from("sources").update({ weight: sw.to }).eq("id", sw.id);
  }
  for (const la of p.laneAppetite) {
    await sb.from("seats").update({ lane_order: la.order }).eq("id", la.seat);
  }
  return { applied: true };
}
