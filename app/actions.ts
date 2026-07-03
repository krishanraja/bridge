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
}

const DEMO_REFUSAL: ActionResult = {
  ok: false,
  message: "Demo mode is read only. Connect the database to write.",
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
  if (seat !== 4) return { ok: false, message: "Only the operator seeds priorities." };
  const sb = await supabaseServer();

  const { count } = await sb
    .from("priorities")
    .select("id", { count: "exact", head: true })
    .is("retired_at", null);
  if ((count ?? 0) >= 5) {
    return { ok: false, message: "Five is the ceiling. Retire one first." };
  }

  const name = input.name.trim().slice(0, 60);
  if (!name) return { ok: false, message: "A priority needs a name." };

  const { error } = await sb.from("priorities").insert({
    name,
    sponsor_seat: input.sponsor_seat,
    display_order: (count ?? 0) + 1,
    blocker: input.blocker?.trim() || null,
  });
  if (error) return { ok: false, message: "That did not save. Try again." };

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
  if (seat !== 4) return { ok: false, message: "Only the operator edits priorities." };
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
  if (error) return { ok: false, message: "That did not save. Try again." };

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
  if (seat !== 4) return { ok: false, message: "Only the operator sets moves. Rewrite proposes instead." };
  const sb = await supabaseServer();

  const text = input.text.trim();
  if (!text) return { ok: false, message: "A move is one sentence with a verb." };

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
        message: "One move per priority per week. Edit this week's move instead.",
      };
    }
    return { ok: false, message: "That did not save. Try again." };
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
    return { ok: false, message: "Missed needs a one line reason." };
  }

  const patch: Record<string, unknown> = {};
  if (input.text !== undefined) {
    const text = input.text.trim();
    if (!text) return { ok: false, message: "A move is one sentence with a verb." };
    patch.text = text;
    if (seat !== 4) patch.state = "proposed";
  }
  if (input.state !== undefined) patch.state = input.state;
  if (input.outcome_note !== undefined) patch.outcome_note = input.outcome_note.trim() || null;

  const { error } = await sb.from("moves").update(patch).eq("id", input.id);
  if (error) return { ok: false, message: "That did not save. Try again." };

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
  if (!text) return { ok: false, message: "A decision needs words." };

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
  if (error) return { ok: false, message: "That did not save. Try again." };

  await logEvent(seat, "decision_log", "decision", data.id, {
    via: input.logged_via ?? "typed",
  });
  revalidatePath("/table");
  revalidatePath("/today");
  return { ok: true };
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
  if (error) return { ok: false, message: "That did not save. Try again." };

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
  if (error) return { ok: false, message: "The vote did not land. Try again." };

  await sb.from("receipts").upsert(
    { seat, artifact_type: "pulse", artifact_id: week },
    { onConflict: "seat,artifact_type,artifact_id", ignoreDuplicates: true },
  );
  await logEvent(seat, "pulse_vote", "pulse", week, { count: rows.length });
  revalidatePath("/table");
  revalidatePath("/priorities");
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
