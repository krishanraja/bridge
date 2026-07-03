/* The brief composer. Opus reads the day and writes the office voice: 220 to
   280 words, four sections, every sentence traced to a record. The operator
   edits until 07:25; then it releases. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";
import { claude, extractJson } from "@/lib/intel/llm";
import { BANNED_LIST } from "@/lib/copy/banned";
import { VOICE } from "@/lib/copy/voice";
import { STYLE_PROFILES } from "@/lib/copy/styles";
import { currentIsoWeek, isoWeekShift } from "@/lib/weeks";
import { SEATS, type SeatId } from "@/lib/seats";
import { LANES, type LaneId } from "@/lib/copy/lanes";

const COMPOSE_MODEL = "claude-opus-4-8";

export interface LineRef {
  line: number;
  refs: string[];
}

export interface RefLabel {
  label: string;
  url: string | null;
}

export interface ComposeResult {
  day: string;
  kind: "morning" | "close";
  script: string;
  line_refs: LineRef[];
  refs: Record<string, RefLabel>;
}

interface Refable {
  ref: string;
  label: string;
  url: string | null;
}

/* Assemble the day's records into a referenced context block. */
async function assemble(kind: "morning" | "close") {
  const sb = supabaseService();
  const day = new Date().toISOString().slice(0, 10);
  const week = currentIsoWeek();
  const prevWeek = isoWeekShift(week, -1);

  const [signalsQ, assumptionsQ, prioritiesQ, movesQ, decisionsQ] = await Promise.all([
    sb
      .from("signals")
      .select("id, headline, for_amperity, posture, lane, score, cluster, assumption_id, assumption_direction")
      .eq("day", day)
      .order("score", { ascending: false })
      .limit(6),
    sb
      .from("assumptions")
      .select("id, statement, confidence, status, history")
      .is("retired_at", null),
    sb.from("priorities").select("id, name, state, sponsor_seat, blocker").is("retired_at", null),
    sb.from("moves").select("priority_id, text, owner_seat, state, iso_week, outcome_note").in("iso_week", [week, prevWeek]),
    sb.from("decisions").select("id, text, owner_seat, due_date, state").eq("state", "open").order("due_date"),
  ]);

  const refs: Refable[] = [];
  const lines: string[] = [];

  const signals = signalsQ.data ?? [];
  lines.push("MARKET (today's deck, highest first):");
  signals.forEach((s, i) => {
    const ref = `S${i + 1}`;
    const url = (s.cluster as { url?: string }[])?.[0]?.url ?? null;
    refs.push({ ref, label: s.headline, url });
    lines.push(
      `[${ref}] (${LANES[s.lane as LaneId]?.name}) ${s.headline}. ${s.for_amperity ?? ""}${s.posture ? ` Move: ${s.posture}` : ""}`,
    );
  });
  if (signals.length === 0) lines.push("The pipeline found nothing that clears the bar today.");

  lines.push("\nHOUSE VIEW (with movement):");
  const cut14 = isoWeekShift(week, -2);
  for (const a of assumptionsQ.data ?? []) {
    const ref = `A${refs.length + 1}`;
    refs.push({ ref, label: a.statement, url: null });
    const hist = (a.history ?? []) as { day: string; confidence: number }[];
    const past = hist.find((h) => h.day <= isoWeekAsDate(cut14));
    const delta = past ? Math.round(Number(a.confidence) - past.confidence) : 0;
    lines.push(
      `[${ref}] ${a.statement} confidence ${Math.round(Number(a.confidence))}, ${a.status}${delta !== 0 ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} in two weeks` : ""}.`,
    );
  }

  lines.push("\nTHE WEEK (this week's moves):");
  const priorities = prioritiesQ.data ?? [];
  const moves = movesQ.data ?? [];
  for (const p of priorities) {
    const ref = `P${refs.length + 1}`;
    refs.push({ ref, label: p.name, url: null });
    const move = moves.find((m) => m.priority_id === p.id && m.iso_week === week);
    const prevMove = moves.find((m) => m.priority_id === p.id && m.iso_week === prevWeek);
    const twoMiss =
      prevMove?.state === "missed" &&
      moves.filter((m) => m.priority_id === p.id && m.state === "missed").length >= 2;
    lines.push(
      `[${ref}] ${p.name}; state ${p.state}` +
        (p.blocker ? `; blocker: ${p.blocker}` : "") +
        (move
          ? `; move (${move.state}, ${SEATS[move.owner_seat as SeatId].shortName}): ${move.text}`
          : "; no move set this week") +
        (twoMiss ? "; MISSED two weeks running" : ""),
    );
  }

  lines.push("\nOPEN DECISIONS:");
  for (const d of decisionsQ.data ?? []) {
    const ref = `D${refs.length + 1}`;
    refs.push({ ref, label: d.text.slice(0, 60), url: null });
    lines.push(
      `[${ref}] ${d.text} Owner ${SEATS[d.owner_seat as SeatId].shortName}${d.due_date ? `, due ${d.due_date}` : ""}.`,
    );
  }

  return { day, context: lines.join("\n"), refs, signals, priorities, moves };
}

function isoWeekAsDate(isoWeek: string): string {
  const [y, w] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export async function compose(
  kind: "morning" | "close",
  seat: SeatId = 1,
): Promise<ComposeResult> {
  const { day, context, refs } = await assemble(kind);
  const style = STYLE_PROFILES[seat];

  const refList = refs.map((r) => r.ref).join(", ");
  const system =
    kind === "morning"
      ? `${VOICE}

Write the morning brief: a spoken read of 220 to 280 words the four leaders hear over coffee. Four short sections with these exact headers: Market, The house, The week, The call.
Market: the two or three things that actually moved, in plain language, and a light word on why each matters to us.
The house: how our thinking is holding up, one belief that shifted.
The week: where the moves stand. If something slipped, say so kindly, without blame.
The call: the one thing worth deciding today. Offer it as a suggestion and say whose call it feels like. Never tell them what they will do.
This reader likes it delivered like this: ${style.memo}
Sound like a warm colleague talking, not a report. No em dashes. Do not use any of these words: ${BANNED_LIST}.
Every sentence must trace to a record. After each sentence, append the reference codes that support it in square brackets, like [S1] or [P4]. Use only these codes: ${refList}.
Reply with ONLY JSON: {"script": "the full brief with reference codes inline", "line_refs": [{"line": 0, "refs": ["S1"]}]} where line is the zero-based index of each non-empty line and refs are the codes on that line.`
      : `${VOICE}

Write the Friday close: a warm, easy 120 to 160 word wrap on the week for the four leaders. Cover how the moves landed (shipped or slipped, said kindly), a simple count of how many shipped and any pattern worth noticing, the one belief that shifted, and the one thing carrying into next week. End on an encouraging, human note, not a verdict.
No em dashes. Do not use any of these words: ${BANNED_LIST}.
Every sentence traces to a record with reference codes in square brackets. Use only: ${refList}.
Reply with ONLY JSON: {"script": "...", "line_refs": [{"line": 0, "refs": ["P1"]}]}.`;

  const reply = await claude({
    model: COMPOSE_MODEL,
    system,
    user: context,
    maxTokens: 2000,
  });

  let parsed: { script: string; line_refs: LineRef[] };
  try {
    parsed = extractJson(reply);
  } catch {
    /* If the model wrapped prose around the JSON, keep the text and derive refs. */
    const script = reply.replace(/```json|```/g, "").trim();
    parsed = { script, line_refs: deriveRefs(script) };
  }

  const refMap: Record<string, RefLabel> = {};
  for (const r of refs) refMap[r.ref] = { label: r.label, url: r.url };

  /* Guard: drop any reference code the model invented. */
  const valid = new Set(refs.map((r) => r.ref));
  parsed.line_refs = (parsed.line_refs ?? []).map((lr) => ({
    line: lr.line,
    refs: (lr.refs ?? []).filter((r) => valid.has(r)),
  }));

  return { day, kind, script: parsed.script, line_refs: parsed.line_refs, refs: refMap };
}

function deriveRefs(script: string): LineRef[] {
  return script.split("\n").map((line, i) => ({
    line: i,
    refs: [...line.matchAll(/\[([A-Z]\d+)\]/g)].map((m) => m[1]),
  }));
}

/* Persist the draft. The morning brief holds unreleased until the operator
   releases it or 07:25 auto-releases it. */
export async function saveDraft(result: ComposeResult, released: boolean) {
  const sb = supabaseService();
  const { error } = await sb.from("briefs").upsert(
    {
      day: result.day,
      kind: result.kind,
      script: result.script,
      line_refs: result.line_refs,
      refs: result.refs,
      released_at: released ? new Date().toISOString() : null,
    },
    { onConflict: "day,kind" },
  );
  if (error) throw new Error(`brief save: ${error.message}`);
}
