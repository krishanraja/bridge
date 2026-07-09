/* The setup wizard, defined once. Every card's exact plain English question and
   options live here, along with the pure logic that turns the stored answers into
   a chief of staff summary and into the composer's per seat directives. Store the
   value, never the label, so wording can change without touching data.

   No em dashes, no banned words: this file is read by the copy checks. */

import type { SeatPrefs } from "@/lib/types";
import { SEATS, type SeatId } from "@/lib/seats";

export interface PrefOption {
  label: string;
  value: string;
}

export interface PrefCard {
  /* The seat_prefs column this card writes. The seat picker uses "seat". */
  field: string;
  question: string;
  helper?: string;
  options: PrefOption[];
  /* Card 9 gets a touch more room; it is the trust setting the agent reads. */
  emphasis?: boolean;
  /* Card 1: confirm the seat on first run, live picker in the demo. */
  seatPicker?: boolean;
  /* top_focus goes stale, so it is stamped with a date and re-asked after 90 days. */
  expires?: boolean;
}

export const SEAT_CARD: PrefCard = {
  field: "seat",
  question: "Which one is you?",
  seatPicker: true,
  options: [1, 2, 3, 4].map((id) => ({
    label: SEATS[id as SeatId].shortName,
    value: String(id),
  })),
};

/* The eleven core cards, in order. Card 1 is the seat picker above. */
export const CORE_CARDS: PrefCard[] = [
  SEAT_CARD,
  {
    field: "reach_daily",
    question: "Day to day, how should we reach you?",
    options: [
      { label: "A text", value: "text" },
      { label: "A voice note", value: "voice" },
      { label: "Email", value: "email" },
      { label: "Whatever is easiest", value: "any" },
    ],
  },
  {
    field: "reach_urgent",
    question: "When it is urgent?",
    options: [
      { label: "Call me", value: "call" },
      { label: "Text me", value: "text" },
      { label: "Send a voice note", value: "voice" },
    ],
  },
  {
    field: "after_hours",
    question: "Outside working hours?",
    options: [
      { label: "Only real emergencies", value: "emergency" },
      { label: "I do not mind", value: "open" },
      { label: "Never", value: "never" },
    ],
  },
  {
    field: "update_depth",
    question: "How much do you want in an update?",
    options: [
      { label: "Just the headline", value: "headline" },
      { label: "The headline and a little more", value: "some" },
      { label: "The full picture", value: "full" },
    ],
  },
  {
    field: "long_form",
    question: "When there is a lot to say, how do you like it?",
    options: [
      { label: "Short bullet points", value: "bullets" },
      { label: "Written out in sentences", value: "sentences" },
      { label: "Whatever fits", value: "any" },
    ],
  },
  {
    field: "order_pref",
    question: "What comes first?",
    options: [
      { label: "The answer, then the background", value: "answer_first" },
      { label: "The background, then the answer", value: "context_first" },
    ],
  },
  {
    field: "morning_brief",
    question: "Want a morning brief?",
    options: [
      { label: "Yes, first thing", value: "early" },
      { label: "Yes, mid morning", value: "mid" },
      { label: "No thanks", value: "none" },
    ],
  },
  {
    field: "autonomy_default",
    question: "When I spot something that needs doing, what should I do?",
    helper: "You can change this any time.",
    emphasis: true,
    options: [
      { label: "Ask you first", value: "ask" },
      { label: "Do it, then tell you", value: "tell" },
      { label: "Just handle it", value: "handle" },
    ],
  },
  {
    field: "disagree",
    question: "When we do not agree?",
    options: [
      { label: "Tell me once, then go with my call", value: "commit" },
      { label: "Keep pushing if you believe it", value: "push" },
    ],
  },
  {
    field: "visibility",
    question: "Who can see your answers?",
    options: [
      { label: "Just me and my chief of staff", value: "private" },
      { label: "The whole leadership team", value: "team" },
    ],
  },
];

/* The optional deeper cards, offered after the core flow. Each is skippable. */
export const DEEPER_CARDS: PrefCard[] = [
  {
    field: "numbers",
    question: "When it is about numbers or results?",
    options: [
      { label: "Show me the number first", value: "number" },
      { label: "Tell me the story first", value: "story" },
      { label: "Show me a chart", value: "chart" },
    ],
  },
  {
    field: "frequency",
    question: "How often is too often?",
    options: [
      { label: "Only the important things", value: "low" },
      { label: "A few times a day is fine", value: "medium" },
      { label: "Keep it all coming", value: "high" },
    ],
  },
  {
    field: "money",
    question: "Anything with money attached?",
    options: [
      { label: "Always ask me first", value: "ask" },
      { label: "Only if it is big", value: "big" },
      { label: "Your call", value: "trust" },
    ],
  },
  {
    field: "speed",
    question: "Your speed?",
    options: [
      { label: "Move fast, fix as we go", value: "fast" },
      { label: "Get it right, then ship", value: "careful" },
    ],
  },
  {
    field: "feedback",
    question: "How do you like feedback?",
    options: [
      { label: "Straight and direct", value: "direct" },
      { label: "Softened a little", value: "soft" },
    ],
  },
  {
    field: "trust",
    question: "What do you trust more?",
    options: [
      { label: "The data", value: "data" },
      { label: "Your gut", value: "gut" },
    ],
  },
  {
    field: "top_focus",
    question: "What matters most right now?",
    expires: true,
    options: [
      { label: "Growth", value: "growth" },
      { label: "Product", value: "product" },
      { label: "The team", value: "team" },
      { label: "Fundraising", value: "fundraise" },
      { label: "Customers", value: "customers" },
    ],
  },
  {
    field: "sharp_time",
    question: "When are you sharpest?",
    options: [
      { label: "Morning", value: "morning" },
      { label: "Evening", value: "evening" },
      { label: "No pattern", value: "none" },
    ],
  },
  {
    field: "autonomy_scheduling",
    question: "Scheduling and calendar?",
    options: TRUST_OPTIONS(),
  },
  {
    field: "autonomy_messages",
    question: "Sending messages on your behalf?",
    options: TRUST_OPTIONS(),
  },
  {
    field: "autonomy_research",
    question: "Research and prep?",
    options: TRUST_OPTIONS(),
  },
];

function TRUST_OPTIONS(): PrefOption[] {
  return [
    { label: "Ask", value: "ask" },
    { label: "Do it, tell you", value: "tell" },
    { label: "Just handle it", value: "handle" },
  ];
}

export const ALL_CARDS: PrefCard[] = [...CORE_CARDS, ...DEEPER_CARDS];

export function cardFor(field: string): PrefCard | undefined {
  return ALL_CARDS.find((c) => c.field === field);
}

/* The chief of staff cheat sheet, assembled from the stored values. Skipped
   fields are omitted so the sentence still reads cleanly, and nothing is claimed
   that was not answered. Written name forward and pronoun light, since the wizard
   never asks for a pronoun. */
export function buildSummary(prefs: Partial<SeatPrefs> & { seat: SeatId }): string {
  const name = SEATS[prefs.seat].shortName;
  const parts: string[] = [];

  const daily: Record<string, string> = {
    text: `Reach ${name} by text.`,
    voice: `Reach ${name} with a voice note.`,
    email: `Reach ${name} by email.`,
    any: `Reach ${name} whatever way is easiest.`,
  };
  if (prefs.reach_daily && daily[prefs.reach_daily]) parts.push(daily[prefs.reach_daily]);

  const urgent: Record<string, string> = {
    call: "If it is urgent, call.",
    text: "If it is urgent, text.",
    voice: "If it is urgent, send a voice note.",
  };
  if (prefs.reach_urgent && urgent[prefs.reach_urgent]) parts.push(urgent[prefs.reach_urgent]);

  const hours: Record<string, string> = {
    emergency: "Outside hours, only for a real emergency.",
    open: "Outside hours is fine.",
    never: "Never outside working hours.",
  };
  if (prefs.after_hours && hours[prefs.after_hours]) parts.push(hours[prefs.after_hours]);

  /* Depth, format, and order read best as one sentence. */
  const depth: Record<string, string> = {
    headline: "just the headline",
    some: "the headline and a little more",
    full: "the full picture",
  };
  const form: Record<string, string> = {
    bullets: "in bullet points",
    sentences: "written out in sentences",
    any: "",
  };
  const order: Record<string, string> = {
    answer_first: "answer before the background",
    context_first: "background before the answer",
  };
  if (prefs.update_depth && depth[prefs.update_depth]) {
    let s = `Wants ${depth[prefs.update_depth]}`;
    const f = prefs.long_form ? form[prefs.long_form] : "";
    if (f) s += `, ${f}`;
    const o = prefs.order_pref ? order[prefs.order_pref] : "";
    if (o) s += `, ${o}`;
    parts.push(s + ".");
  }

  const brief: Record<string, string> = {
    early: "Send a morning brief first thing.",
    mid: "Send a morning brief mid morning.",
    none: "No morning brief.",
  };
  if (prefs.morning_brief && brief[prefs.morning_brief]) parts.push(brief[prefs.morning_brief]);

  const auto: Record<string, string> = {
    ask: "On small things, ask first.",
    tell: "On small things, do it, then tell.",
    handle: "On small things, just handle them.",
  };
  if (prefs.autonomy_default && auto[prefs.autonomy_default]) parts.push(auto[prefs.autonomy_default]);

  const dis: Record<string, string> = {
    commit: "When you disagree, say it once, then go with the call.",
    push: "When you disagree, keep pushing if you believe it.",
  };
  if (prefs.disagree && dis[prefs.disagree]) parts.push(dis[prefs.disagree]);

  const money: Record<string, string> = {
    ask: "On anything with money, always ask first.",
    big: "On money, ask only if it is big.",
    trust: "On money, your call.",
  };
  if (prefs.money && money[prefs.money]) parts.push(money[prefs.money]);

  const numbers: Record<string, string> = {
    number: "Show the number first.",
    story: "Tell the story first.",
    chart: "Show a chart.",
  };
  if (prefs.numbers && numbers[prefs.numbers]) parts.push(numbers[prefs.numbers]);

  /* A short closing character line from speed, feedback, and trust. */
  const tail: string[] = [];
  if (prefs.feedback === "direct") tail.push("likes it straight");
  if (prefs.feedback === "soft") tail.push("likes it softened a little");
  if (prefs.speed === "fast") tail.push("moves fast");
  if (prefs.speed === "careful") tail.push("gets it right, then ships");
  if (prefs.trust === "data") tail.push("trusts the data");
  if (prefs.trust === "gut") tail.push("trusts the gut");
  if (tail.length) parts.push(capitalize(joinList(tail)) + ".");

  const focus: Record<string, string> = {
    growth: "Right now, growth matters most.",
    product: "Right now, the product matters most.",
    team: "Right now, the team matters most.",
    fundraise: "Right now, fundraising matters most.",
    customers: "Right now, customers matter most.",
  };
  if (prefs.top_focus && focus[prefs.top_focus]) parts.push(focus[prefs.top_focus]);

  if (parts.length === 0) {
    return `${name} has not filled this in yet.`;
  }
  return parts.join(" ");
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface StyleDirectives {
  /* A prose memo for the composer's per seat line, and for the Ask voice. */
  memo: string | null;
  length: string;
  format: string;
  order: string;
}

/* Turn the structured answers into short imperative clauses the brief composer
   injects. Returns memo null when there is nothing to say, so the composer falls
   back to its static style profile. */
export function styleDirectives(prefs: Partial<SeatPrefs> | null): StyleDirectives {
  const length =
    prefs?.update_depth === "headline"
      ? "Keep it very short, well under 150 words. Only the essentials."
      : prefs?.update_depth === "some"
        ? "Keep it tight, about 150 to 200 words."
        : prefs?.update_depth === "full"
          ? "Give the full picture, the usual 220 to 280 words."
          : "";
  const format =
    prefs?.long_form === "bullets"
      ? "Use short bullet points, one per line, not flowing prose."
      : prefs?.long_form === "sentences"
        ? "Write in warm, full sentences."
        : "";
  const order =
    prefs?.order_pref === "answer_first"
      ? "Lead with the answer and the one call, then the background."
      : prefs?.order_pref === "context_first"
        ? "Set the background first, then land the answer."
        : "";

  const clauses = [length, format, order].filter(Boolean);
  const memo = clauses.length ? clauses.join(" ") : null;
  return { memo, length, format, order };
}

/* A stored focus older than ninety days is worse than none, so it is re-asked. */
export function focusExpired(prefs: Partial<SeatPrefs> | null): boolean {
  if (!prefs?.top_focus || !prefs.focus_set_on) return false;
  const set = new Date(prefs.focus_set_on + "T00:00:00").getTime();
  return Date.now() - set > 90 * 86400000;
}
