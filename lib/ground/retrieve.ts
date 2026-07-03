/* Grounding for Ask: the house view, priorities, moves, decisions, and the
   nearest signals by embedding. Cited or silent. */

import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { embed } from "@/lib/intel/llm";
import { currentIsoWeek } from "@/lib/weeks";
import { SEATS, type SeatId } from "@/lib/seats";
import { LANES, type LaneId } from "@/lib/copy/lanes";

export interface Citation {
  ref: string;
  label: string;
  url: string | null;
  kind: "signal" | "assumption" | "priority" | "decision";
}

export interface Grounding {
  context: string;
  citations: Citation[];
}

export async function retrieve(query: string): Promise<Grounding> {
  const sb = await supabaseServer();
  const week = currentIsoWeek();

  let queryEmbedding: number[] | null = null;
  try {
    [queryEmbedding] = await embed([query.slice(0, 500)]);
  } catch {
    /* retrieval falls back to structural context only */
  }

  const [assumptionsQ, prioritiesQ, movesQ, decisionsQ, signalsQ] = await Promise.all([
    sb
      .from("assumptions")
      .select("id, statement, rationale, confidence, status, kind")
      .is("retired_at", null),
    sb.from("priorities").select("id, name, sponsor_seat, state, blocker").is("retired_at", null),
    sb.from("moves").select("priority_id, text, owner_seat, state, iso_week").eq("iso_week", week),
    sb
      .from("decisions")
      .select("id, text, owner_seat, due_date, state")
      .order("created_at", { ascending: false })
      .limit(10),
    queryEmbedding
      ? sb.rpc("match_signals", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: 6,
          days_back: 30,
        })
      : Promise.resolve({ data: [] }),
  ]);

  const citations: Citation[] = [];
  const lines: string[] = [];

  lines.push("HOUSE VIEW (assumptions and watch items):");
  for (const a of assumptionsQ.data ?? []) {
    const ref = `A${citations.length + 1}`;
    citations.push({ ref, label: a.statement, url: null, kind: "assumption" });
    lines.push(
      `[${ref}] ${a.statement} (confidence ${Math.round(Number(a.confidence))}, ${a.status}). ${a.rationale ?? ""}`,
    );
  }

  lines.push("\nPRIORITIES and this week's moves:");
  for (const p of prioritiesQ.data ?? []) {
    const ref = `P${citations.length + 1}`;
    citations.push({ ref, label: p.name, url: null, kind: "priority" });
    const move = (movesQ.data ?? []).find((m) => m.priority_id === p.id);
    lines.push(
      `[${ref}] ${p.name}; sponsor ${SEATS[p.sponsor_seat as SeatId].shortName}; state ${p.state}` +
        (p.blocker ? `; blocker: ${p.blocker}` : "") +
        (move
          ? `; this week's move (${move.state}, ${SEATS[move.owner_seat as SeatId].shortName}): ${move.text}`
          : "; no move set this week"),
    );
  }

  lines.push("\nRECENT DECISIONS:");
  for (const d of decisionsQ.data ?? []) {
    const ref = `D${citations.length + 1}`;
    citations.push({ ref, label: d.text.slice(0, 80), url: null, kind: "decision" });
    lines.push(
      `[${ref}] ${d.text} Owner ${SEATS[d.owner_seat as SeatId].shortName}; ${d.state}` +
        (d.due_date ? `; due ${d.due_date}` : ""),
    );
  }

  const signals = (signalsQ.data ?? []) as {
    headline: string;
    for_amperity: string | null;
    posture: string | null;
    day: string;
    lane: number;
    cluster: { url?: string; source?: string }[];
    similarity: number;
  }[];
  if (signals.length > 0) {
    lines.push("\nRECENT MARKET SIGNALS (most relevant first):");
    for (const s of signals) {
      if (s.similarity < 0.15) continue;
      const ref = `S${citations.length + 1}`;
      citations.push({
        ref,
        label: s.headline,
        url: s.cluster?.[0]?.url ?? null,
        kind: "signal",
      });
      lines.push(
        `[${ref}] (${s.day}, ${LANES[s.lane as LaneId]?.name ?? s.lane}) ${s.headline}. ${s.for_amperity ?? ""}${s.posture ? ` The move: ${s.posture}` : ""}`,
      );
    }
  }

  return { context: lines.join("\n"), citations };
}
