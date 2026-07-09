/* The trust setting the agent reads before it acts. A leader's setup answer
   decides whether the agent asks first, acts then tells, or just handles it. The
   default is the most cautious, ask, so an unset seat is never acted on. Per
   domain answers (scheduling, messages, research) override the general default
   when present. Pure, so it is safe to unit test and to read on client or server. */

import type { SeatPrefs } from "@/lib/types";

export type Autonomy = "ask" | "tell" | "handle";

export type AutonomyDomain = "scheduling" | "messages" | "research" | "general";

function normalize(v: string | null | undefined): Autonomy | null {
  return v === "ask" || v === "tell" || v === "handle" ? v : null;
}

export function autonomyFor(
  prefs: Partial<SeatPrefs> | null,
  domain: AutonomyDomain = "general",
): Autonomy {
  if (!prefs) return "ask";
  const perDomain =
    domain === "scheduling"
      ? prefs.autonomy_scheduling
      : domain === "messages"
        ? prefs.autonomy_messages
        : domain === "research"
          ? prefs.autonomy_research
          : null;
  return normalize(perDomain) ?? normalize(prefs.autonomy_default) ?? "ask";
}

/* Map an Ask command intent onto a trust domain. Setting a move or logging a
   decision are day to day judgement calls, so they read the general default;
   there is no scheduling or messaging surface in Ask today. */
export function domainForIntent(kind: string): AutonomyDomain {
  switch (kind) {
    case "set_move":
    case "log_decision":
      return "general";
    default:
      return "general";
  }
}
