"use server";

/* The write paths. Every action verifies the seat server side; RLS enforces it
   again in the database. Operator curation is recorded in the audit log. */

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { currentSeat } from "@/lib/auth";
import { isDemoMode, hasSupabaseEnv } from "@/lib/mode";
import { currentIsoWeek } from "@/lib/weeks";
import type { SeatId } from "@/lib/seats";

export interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

const DEMO_REFUSAL: ActionResult = {
  ok: false,
  message: "This is sample data, so nothing saves here. The live version writes for real.",
};

async function seatOrNull(): Promise<SeatId | null> {
  if (isDemoMode() || !hasSupabaseEnv()) return null;
  return currentSeat();
}

async function logEvent(
  seat: SeatId,
  type: string,
  subjectType: string,
  subjectId: string,
  value?: Record<string, unknown>,
) {
  const sb = await supabaseServer();
  await sb.from("events").insert({
    seat,
    type,
    subject_type: subjectType,
    subject_id: subjectId,
    value: value ?? null,
  });
}

async function logAudit(seat: SeatId, action: string, detail: Record<string, unknown>) {
  const sb = await supabaseServer();
  await sb.from("audit_log").insert({ seat, action, detail });
}

/* Priorities: operator only. Five is the ceiling. */

export async function createPriority(input: {
  name: string;
  sponsor_seat: SeatId;
  blocker?: string | null;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  if (seat !== 4) return { ok: false, message: "Krish sets up the priorities, but you can shape everything else." };
  const sb = await supabaseServer();

  const { count } = await sb
    .from("priorities")
    .select("id", { count: "exact", head: true })
    .is("retired_at", null);
  if ((count ?? 0) >= 5) {
    return { ok: false, message: "Five priorities feels like plenty. Worth retiring one before adding another." };
  }

  const name = input.name.trim().slice(0, 60);
  if (!name) return { ok: false, message: "This one needs a name to save." };

  const { error } = await sb.from("priorities").insert({
    name,
    sponsor_seat: input.sponsor_seat,
    display_order: (count ?? 0) + 1,
    blocker: input.blocker?.trim() || null,
  });
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logAudit(seat, "priority_create", { name });
  revalidatePath("/priorities");
  revalidatePath("/today");
  return { ok: true };
}

export async function updatePriority(input: {
  id: string;
  name?: string;
  state?: string;
  sponsor_seat?: SeatId;
  blocker?: string | null;
  blocker_owner_seat?: SeatId | null;
  display_order?: number;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  if (seat !== 4) return { ok: false, message: "Krish looks after the priorities themselves." };
  const sb = await supabaseServer();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim().slice(0, 60);
  if (input.state !== undefined) patch.state = input.state;
  if (input.sponsor_seat !== undefined) patch.sponsor_seat = input.sponsor_seat;
  if (input.blocker !== undefined) patch.blocker = input.blocker?.trim() || null;
  if (input.blocker_owner_seat !== undefined) patch.blocker_owner_seat = input.blocker_owner_seat;
  if (input.display_order !== undefined) patch.display_order = input.display_order;
  if (input.state === "retired") patch.retired_at = new Date().toISOString();

  const { error } = await sb.from("priorities").update(patch).eq("id", input.id);
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logAudit(seat, "priority_update", { id: input.id, ...patch });
  revalidatePath("/priorities");
  revalidatePath("/today");
  revalidatePath("/table");
  return { ok: true };
}

/* Moves: the operator sets and edits; one per priority per week is the law. */

export async function setMove(input: {
  priority_id: string;
  text: string;
  owner_seat: SeatId;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  if (seat !== 4) return { ok: false, message: "Krish sets the moves, but you can suggest a rewrite any time." };
  const sb = await supabaseServer();

  const text = input.text.trim();
  if (!text) return { ok: false, message: "A move works best as one clear sentence." };

  const { error } = await sb.from("moves").insert({
    priority_id: input.priority_id,
    iso_week: currentIsoWeek(),
    text,
    owner_seat: input.owner_seat,
    state: "proposed",
  });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "There is already a move for this priority this week. You can edit that one.",
      };
    }
    return { ok: false, message: "That did not save. Mind trying again?" };
  }

  await logAudit(seat, "move_set", { priority_id: input.priority_id, text });
  revalidatePath("/priorities");
  revalidatePath("/today");
  return { ok: true };
}

export async function updateMove(input: {
  id: string;
  text?: string;
  state?: "proposed" | "agreed" | "shipped" | "missed";
  outcome_note?: string;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();

  if (input.state === "missed" && !input.outcome_note?.trim()) {
    return { ok: false, message: "A quick note on what got in the way helps here." };
  }

  const patch: Record<string, unknown> = {};
  if (input.text !== undefined) {
    const text = input.text.trim();
    if (!text) return { ok: false, message: "A move works best as one clear sentence." };
    patch.text = text;
    if (seat !== 4) patch.state = "proposed";
  }
  if (input.state !== undefined) patch.state = input.state;
  if (input.outcome_note !== undefined) patch.outcome_note = input.outcome_note.trim() || null;

  const { error } = await sb.from("moves").update(patch).eq("id", input.id);
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  const eventType =
    input.state === "agreed"
      ? "move_agree"
      : input.text !== undefined
        ? "move_rewrite"
        : "move_update";
  await logEvent(seat, eventType, "move", input.id, patch);
  if (seat === 4) await logAudit(seat, "move_edit", { id: input.id, ...patch });
  revalidatePath("/priorities");
  revalidatePath("/today");
  return { ok: true };
}

/* Decisions: any seat logs; the owner or the operator closes. */

export async function logDecision(input: {
  text: string;
  owner_seat: SeatId;
  due_date?: string | null;
  logged_via?: "voice" | "typed";
  transcript?: string | null;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();

  const text = input.text.trim();
  if (!text) return { ok: false, message: "Add a line or two and it will save." };

  const { data, error } = await sb
    .from("decisions")
    .insert({
      text,
      owner_seat: input.owner_seat,
      due_date: input.due_date || null,
      logged_by: seat,
      logged_via: input.logged_via ?? "typed",
      transcript: input.transcript ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logEvent(seat, "decision_log", "decision", data.id, {
    via: input.logged_via ?? "typed",
  });
  revalidatePath("/table");
  revalidatePath("/today");
  return { ok: true, id: data.id };
}

export async function updateDecision(input: {
  id: string;
  state: "open" | "done" | "dropped";
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();

  const { error } = await sb
    .from("decisions")
    .update({ state: input.state })
    .eq("id", input.id);
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  if (seat === 4) await logAudit(seat, "decision_state", { id: input.id, state: input.state });
  revalidatePath("/table");
  revalidatePath("/today");
  return { ok: true };
}

/* The pulse: one vote per seat per priority per week, upserted. */

export async function votePulse(
  votes: { priority_id: string; confidence: number }[],
): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();
  const week = currentIsoWeek();

  const rows = votes.map((v) => ({
    iso_week: week,
    seat,
    priority_id: v.priority_id,
    confidence: Math.max(0, Math.min(100, Math.round(v.confidence))),
  }));
  const { error } = await sb
    .from("pulses")
    .upsert(rows, { onConflict: "iso_week,seat,priority_id" });
  if (error) return { ok: false, message: "That did not go through. Mind trying again?" };

  await sb.from("receipts").upsert(
    { seat, artifact_type: "pulse", artifact_id: week },
    { onConflict: "seat,artifact_type,artifact_id", ignoreDuplicates: true },
  );
  await logEvent(seat, "pulse_vote", "pulse", week, { count: rows.length });
  revalidatePath("/table");
  revalidatePath("/priorities");
  return { ok: true };
}

/* Threads: the relationships lane. The operator creates and edits; any seat
   can move the status of a thread they can see. Surfaced on a priority's
   linked items and as an eligible Today focus. */

export async function createThread(input: {
  name: string;
  org: string;
  seat_owner: SeatId;
  next_touch_date?: string | null;
  next_touch_note?: string | null;
  linked_priority_id?: string | null;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  if (seat !== 4) return { ok: false, message: "Krish opens new threads, but anyone can move one along." };
  const sb = await supabaseServer();
  const name = input.name.trim();
  const org = input.org.trim();
  if (!name || !org) return { ok: false, message: "A name and an org will get this started." };

  const { error } = await sb.from("threads").insert({
    name,
    org,
    seat_owner: input.seat_owner,
    next_touch_date: input.next_touch_date || null,
    next_touch_note: input.next_touch_note?.trim() || null,
    linked_priority_id: input.linked_priority_id || null,
  });
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logAudit(seat, "thread_create", { name, org });
  revalidatePath("/priorities");
  revalidatePath("/today");
  return { ok: true };
}

export async function updateThread(input: {
  id: string;
  status?: "advancing" | "stalled" | "dormant";
  next_touch_date?: string | null;
  next_touch_note?: string | null;
  last_touch_date?: string | null;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();

  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.next_touch_date !== undefined) patch.next_touch_date = input.next_touch_date || null;
  if (input.next_touch_note !== undefined)
    patch.next_touch_note = input.next_touch_note?.trim() || null;
  if (input.last_touch_date !== undefined) patch.last_touch_date = input.last_touch_date || null;

  const { error } = await sb.from("threads").update(patch).eq("id", input.id);
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logEvent(seat, "thread_update", "thread", input.id, patch);
  revalidatePath("/priorities");
  revalidatePath("/today");
  return { ok: true };
}

/* Radar verdicts: Act routes to the operator, Hold archives, Kill teaches. */

export async function signalVerdict(input: {
  signal_id: string;
  kind: "act" | "hold" | "kill";
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return { ok: true };
  await logEvent(seat, `signal_${input.kind}`, "signal", input.signal_id);
  revalidatePath("/radar");
  revalidatePath("/today");
  return { ok: true };
}

export async function openCard(signal_id: string): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return { ok: true };
  await logEvent(seat, "card_open", "signal", signal_id);
  return { ok: true };
}

/* The universal reaction: a leader's thumb up/down on any object, plus optional
   reason tags. One position per seat per object; re-tapping updates it. This is
   the signal the per-seat taste model and the team knowledge graph learn from. */
export async function react(input: {
  subject_type:
    | "signal"
    | "decision"
    | "brief"
    | "move"
    | "assumption"
    | "theme";
  subject_id: string;
  sentiment: 1 | -1;
  reason_tags?: string[];
  note?: string | null;
  lane?: number | null;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();
  const { error } = await sb.from("reactions").upsert(
    {
      seat,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      sentiment: input.sentiment,
      reason_tags: input.reason_tags ?? [],
      note: input.note ?? null,
      lane: input.lane ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seat,subject_type,subject_id" },
  );
  if (error) return { ok: false, message: "That didn't save. Mind trying again?" };
  await logEvent(seat, "reaction", input.subject_type, input.subject_id, {
    sentiment: input.sentiment,
    tags: input.reason_tags ?? [],
  });
  revalidatePath("/radar");
  revalidatePath("/table");
  revalidatePath("/today");
  return { ok: true };
}

/* A principal reweights a belief: their vote pulls confidence, logged in full. */

export async function voteAssumption(input: {
  id: string;
  confidence: number;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const vote = Math.max(0, Math.min(100, Math.round(input.confidence)));

  const { supabaseService } = await import("@/lib/supabase/service");
  const svc = supabaseService();
  const { data: a } = await svc
    .from("assumptions")
    .select("confidence, history")
    .eq("id", input.id)
    .single();
  if (!a) return { ok: false, message: "That belief is not in the ledger." };

  const next = Math.round(0.7 * Number(a.confidence) + 0.3 * vote);
  const day = new Date().toISOString().slice(0, 10);
  const history = [
    ...((a.history ?? []) as { day: string; confidence: number }[]),
    { day, confidence: next },
  ].slice(-120);
  await svc.from("assumptions").update({ confidence: next, history }).eq("id", input.id);

  await logEvent(seat, "assumption_vote", "assumption", input.id, { vote, next });
  await logAudit(seat, "assumption_vote", { id: input.id, vote, next });
  revalidatePath("/ledger");
  return { ok: true };
}

/* The operator opens a Watch item: a slow-moving belief the table wants to track
   as the market argues with it. Structural trends live here and accrete evidence
   over weeks. Operator only; the table reads on it once it is up. */
export async function openWatch(input: {
  statement: string;
  rationale?: string;
}): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  if (seat !== 4) return { ok: false, message: "Krish opens the watch items, but the table reads on every one." };
  const sb = await supabaseServer();

  const statement = input.statement.trim().slice(0, 120);
  if (!statement) return { ok: false, message: "A watch needs a one-line belief to track." };

  const { error } = await sb.from("assumptions").insert({
    statement,
    rationale: input.rationale?.trim() || null,
    kind: "force",
    confidence: 50,
    status: "holding",
  });
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };

  await logAudit(seat, "watch_open", { statement });
  revalidatePath("/ledger");
  return { ok: true };
}

/* The fifteen second undo on a voice logged decision: the logger can take
   back their own entry while it is still warm. */

export async function undoRecentDecision(id: string): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const { supabaseService } = await import("@/lib/supabase/service");
  const svc = supabaseService();
  const { data: d } = await svc
    .from("decisions")
    .select("logged_by, created_at")
    .eq("id", id)
    .single();
  if (!d || d.logged_by !== seat) return { ok: false, message: "Not yours to undo." };
  if (Date.now() - new Date(d.created_at).getTime() > 60000) {
    return { ok: false, message: "The undo window has closed. Drop it from the log instead." };
  }
  await svc.from("decisions").delete().eq("id", id);
  await logEvent(seat, "decision_undo", "decision", id);
  revalidatePath("/table");
  revalidatePath("/today");
  return { ok: true };
}

/* Receipts: seen facts for the brief and the pulse only. */

export async function markBriefSeen(day: string): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return { ok: true };
  const sb = await supabaseServer();
  await sb.from("receipts").upsert(
    { seat, artifact_type: "brief", artifact_id: day },
    { onConflict: "seat,artifact_type,artifact_id", ignoreDuplicates: true },
  );
  await logEvent(seat, "brief_play", "brief", day);
  revalidatePath("/table");
  return { ok: true };
}

/* Per-decision receipts: seen on open, then concur or feedback. The table sees
   who has viewed each decision and who has taken a position on it. */

export async function markDecisionSeen(decisionId: string): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return { ok: true };
  const sb = await supabaseServer();
  await sb.from("receipts").upsert(
    { seat, artifact_type: "decision", artifact_id: decisionId },
    { onConflict: "seat,artifact_type,artifact_id", ignoreDuplicates: true },
  );
  revalidatePath("/table");
  return { ok: true };
}

export async function concurDecision(decisionId: string): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const sb = await supabaseServer();
  const { error } = await sb.from("decision_signoffs").upsert(
    { seat, decision_id: decisionId, stance: "concur", note: null, updated_at: new Date().toISOString() },
    { onConflict: "seat,decision_id" },
  );
  if (error) return { ok: false, message: "That did not go through. Mind trying again?" };
  await logEvent(seat, "decision_concur", "decision", decisionId);
  revalidatePath("/table");
  return { ok: true };
}

export async function leaveDecisionFeedback(
  decisionId: string,
  note: string,
): Promise<ActionResult> {
  const seat = await seatOrNull();
  if (!seat) return DEMO_REFUSAL;
  const text = note.trim();
  if (!text) return { ok: false, message: "A line of feedback is all we need." };
  const sb = await supabaseServer();
  const { error } = await sb.from("decision_signoffs").upsert(
    { seat, decision_id: decisionId, stance: "feedback", note: text, updated_at: new Date().toISOString() },
    { onConflict: "seat,decision_id" },
  );
  if (error) return { ok: false, message: "That did not save. Mind trying again?" };
  await logEvent(seat, "decision_feedback", "decision", decisionId, { note: text });
  revalidatePath("/table");
  return { ok: true };
}
