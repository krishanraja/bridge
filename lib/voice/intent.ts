/* The intent router: one fast haiku call sorts an utterance into the command
   grammar. Below the confidence floor everything falls through to ask, which
   is always safe. */

import "server-only";
import { claude, extractJson, MODELS } from "@/lib/intel/llm";
import { SEATS, SEAT_IDS } from "@/lib/seats";

export type Intent =
  | { kind: "ask"; query: string }
  | { kind: "log_decision"; text: string; owner_seat: number; due_date: string | null }
  | { kind: "set_move"; priority_hint: string; text: string }
  | { kind: "sweep"; topic: string | null }
  | { kind: "navigate"; room: string };

const ROOMS = ["today", "radar", "priorities", "table", "ask", "ledger", "settings"];

/* Questions never share a shape with the command grammar; skip the model. */
const QUESTION_START =
  /^(who|what|where|when|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|tell me|show me|give me|summarize|explain|compare|brief me)\b/i;

export function isPlainQuestion(utterance: string): boolean {
  return QUESTION_START.test(utterance.trim()) || utterance.trim().endsWith("?");
}

export async function routeIntent(
  utterance: string,
  priorities: { id: string; name: string }[],
): Promise<Intent> {
  if (isPlainQuestion(utterance)) return { kind: "ask", query: utterance };
  const seatList = SEAT_IDS.map((id) => `${id} ${SEATS[id].name} (${SEATS[id].shortName})`).join("; ");
  const today = new Date().toISOString().slice(0, 10);

  const system = `You route spoken commands for a leadership app. Today is ${today}.
Seats: ${seatList}.
Active priorities: ${priorities.map((p) => p.name).join("; ") || "none"}.
Rooms: ${ROOMS.join(", ")}.

Classify the utterance into exactly one intent and reply with ONLY JSON:
{"intent": "ask" | "log_decision" | "set_move" | "sweep" | "navigate",
 "confidence": 0.0-1.0,
 "decision_text": "the decision as one clean sentence, when log_decision",
 "owner_seat": 1-4 or null,
 "due_date": "YYYY-MM-DD or null, resolve phrases like end of quarter",
 "priority_hint": "the priority name fragment, when set_move",
 "move_text": "the move as one sentence with a verb, when set_move",
 "topic": "the sweep topic or null",
 "room": "room name, when navigate"}

log_decision: the speaker is recording a decision (log a decision, we decided, we are pausing X).
set_move: setting or changing this week's move on a priority.
sweep: asking to scan or search the market for something new.
navigate: asking to open or go to a room.
Everything else, including every question, is ask.`;

  try {
    const reply = await claude({
      model: MODELS.filter,
      system,
      user: utterance,
      maxTokens: 400,
      attempts: 2,
      maxBackoffSeconds: 3,
    });
    const r = extractJson<{
      intent: string;
      confidence: number;
      decision_text?: string;
      owner_seat?: number | null;
      due_date?: string | null;
      priority_hint?: string;
      move_text?: string;
      topic?: string | null;
      room?: string;
    }>(reply);

    if ((r.confidence ?? 0) < 0.6) return { kind: "ask", query: utterance };

    switch (r.intent) {
      case "log_decision":
        if (!r.decision_text) break;
        return {
          kind: "log_decision",
          text: r.decision_text,
          owner_seat: r.owner_seat && r.owner_seat >= 1 && r.owner_seat <= 4 ? r.owner_seat : 4,
          due_date: r.due_date ?? null,
        };
      case "set_move":
        if (!r.move_text) break;
        return { kind: "set_move", priority_hint: r.priority_hint ?? "", text: r.move_text };
      case "sweep":
        return { kind: "sweep", topic: r.topic ?? null };
      case "navigate":
        if (r.room && ROOMS.includes(r.room)) return { kind: "navigate", room: r.room };
        break;
    }
  } catch {
    /* fall through to ask */
  }
  return { kind: "ask", query: utterance };
}
