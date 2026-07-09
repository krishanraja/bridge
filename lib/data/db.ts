/* Database data source. Raw rows in, shared derivations out. */

import { supabaseServer } from "@/lib/supabase/server";
import type { Decision, Move, Priority, Pulse, RoutedSignal, SeatPrefs, Signal, Thread } from "@/lib/types";
import type { SeatId } from "@/lib/seats";
import { SEAT_IDS } from "@/lib/seats";
import { currentIsoWeek, isoWeekShift } from "@/lib/weeks";
import {
  deriveFocus,
  derivePriorityViews,
  deriveTable,
  topSignals,
  weekMoveDots,
} from "./derive";
import type {
  DeckView,
  DecisionReceipt,
  LedgerData,
  PriorityView,
  SeatReaction,
  TableData,
  ThemeView,
  TodayData,
} from "./views";
import { computeAffinity, personalize } from "@/lib/learn/affinity";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* Setup prefs. RLS returns only the rows this seat may see (own, team, or all
   for the operator), so the reader trusts the database to scope it. */
export async function dbSeatPrefs(seat: SeatId): Promise<SeatPrefs | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("seat_prefs").select("*").eq("seat", seat).maybeSingle();
  return (data as SeatPrefs | null) ?? null;
}

export async function dbAllSeatPrefs(): Promise<SeatPrefs[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("seat_prefs").select("*").order("seat");
  return (data ?? []) as SeatPrefs[];
}

/* The freshest day that actually carries signals, on or before today. The deck
   is dealt by a morning cron; before it runs, or on a genuinely quiet day, the
   radar should still show the last real deck rather than go dark. */
async function latestSignalDay(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  onOrBefore: string,
): Promise<string | null> {
  const { data } = await sb
    .from("signals")
    .select("day")
    .eq("channel", "act")
    .lte("day", onOrBefore)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.day ?? null;
}

export async function dbToday(): Promise<TodayData> {
  const sb = await supabaseServer();
  const day = todayISO();
  const week = currentIsoWeek();
  const deckDay = (await latestSignalDay(sb, day)) ?? day;

  const [signalsQ, prioritiesQ, movesQ, decisionsQ, threadsQ, briefQ] =
    await Promise.all([
      sb.from("signals").select("*").eq("day", deckDay).eq("channel", "act"),
      sb.from("priorities").select("*").is("retired_at", null),
      sb.from("moves").select("*").eq("iso_week", week),
      sb.from("decisions").select("*").eq("state", "open"),
      sb.from("threads").select("*"),
      sb
        .from("briefs")
        .select("day, script, audio_path, line_refs, refs")
        .eq("day", day)
        .eq("kind", "morning")
        .not("released_at", "is", null)
        .maybeSingle(),
    ]);

  const signals = (signalsQ.data ?? []) as Signal[];
  const priorities = (prioritiesQ.data ?? []) as Priority[];
  const moves = (movesQ.data ?? []) as Move[];
  const decisions = (decisionsQ.data ?? []) as Decision[];
  const threads = (threadsQ.data ?? []) as Thread[];

  let audioUrl: string | null = null;
  if (briefQ.data?.audio_path) {
    const signed = await sb.storage
      .from("audio")
      .createSignedUrl(briefQ.data.audio_path, 600);
    audioUrl = signed.data?.signedUrl ?? null;
  }

  /* Operator review: an unreleased morning draft waiting on the review window.
     Only the operator sees it. */
  let review = null;
  let routed: RoutedSignal[] = [];
  const { data: userData } = await sb.auth.getUser();
  const { seatForEmail } = await import("@/lib/seats");
  const viewer = userData.user?.email ? seatForEmail(userData.user.email) : null;
  if (viewer === 4) {
    const { data: draft } = await sb
      .from("briefs")
      .select("day, kind, script")
      .eq("day", day)
      .eq("kind", "morning")
      .is("released_at", null)
      .maybeSingle();
    if (draft) {
      review = {
        day: draft.day,
        kind: draft.kind as "morning" | "close",
        script: draft.script,
        windowOpen: true,
        releaseAt: "07:25",
      };
    }
    const { data: routedRows } = await sb
      .from("routed_signals")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    routed = (routedRows ?? []) as RoutedSignal[];
  }

  return {
    brief: briefQ.data
      ? {
          day: briefQ.data.day,
          script: briefQ.data.script,
          audioPath: audioUrl,
          released: true,
          lineRefs: (briefQ.data.line_refs ?? []) as { line: number; refs: string[] }[],
          refLabels: (briefQ.data.refs ?? {}) as Record<
            string,
            { label: string; url: string | null }
          >,
        }
      : null,
    review,
    focus: deriveFocus({
      decisions,
      priorities,
      moves,
      signals,
      threads,
      todayISO: day,
      isoWeek: week,
    }),
    topSignals: topSignals(signals, 3),
    weekMoves: weekMoveDots(priorities, moves, week),
    routed,
    demo: false,
  };
}

export async function dbDeck(): Promise<DeckView> {
  const sb = await supabaseServer();
  const day = (await latestSignalDay(sb, todayISO())) ?? todayISO();
  const seatQ = await sb.auth.getUser();
  const email = seatQ.data.user?.email?.toLowerCase();
  const { seatForEmail } = await import("@/lib/seats");
  const seat = email ? seatForEmail(email) : null;

  const [signalsQ, verdictsQ, reactionsQ] = await Promise.all([
    sb
      .from("signals")
      .select("*")
      .eq("day", day)
      .eq("channel", "act")
      .order("score", { ascending: false })
      .limit(12),
    sb
      .from("events")
      .select("subject_id, seat, type")
      .in("type", ["signal_act", "signal_hold", "signal_kill"])
      .gte("created_at", `${day}T00:00:00Z`),
    seat
      ? sb
          .from("reactions")
          .select("subject_id, sentiment, reason_tags, lane")
          .eq("seat", seat)
          .eq("subject_type", "signal")
          .limit(500)
      : Promise.resolve({ data: [] as ReactionRow[] }),
  ]);

  const dismissed = new Set(
    (verdictsQ.data ?? []).filter((v) => v.seat === seat).map((v) => v.subject_id),
  );
  const reactionRows = (reactionsQ.data ?? []) as ReactionRow[];

  /* Learn this seat's lane appetite from every signal reaction, then re-rank the
     day's deck by it. New leaders (no reactions) see the pooled order. */
  const affinity = computeAffinity(
    reactionRows.map((r) => ({ lane: r.lane, sentiment: r.sentiment })),
  );
  const visible = ((signalsQ.data ?? []) as Signal[]).filter(
    (s) => !dismissed.has(s.id),
  );
  const ranked = personalize(visible, affinity);

  const reactions: Record<string, SeatReaction> = {};
  for (const r of reactionRows) {
    reactions[r.subject_id] = {
      sentiment: r.sentiment,
      tags: r.reason_tags ?? [],
    };
  }

  return {
    signals: ranked,
    reactions,
    topLanes: affinity.topLanes,
    mutedLanes: affinity.mutedLanes,
  };
}

interface ReactionRow {
  subject_id: string;
  sentiment: 1 | -1;
  reason_tags: string[] | null;
  lane: number | null;
}

export async function dbPriorityViews(): Promise<PriorityView[]> {
  const sb = await supabaseServer();
  const week = currentIsoWeek();
  const prevWeek = isoWeekShift(week, -1);
  const weeks = Array.from({ length: 6 }, (_, i) => isoWeekShift(week, -i));

  const [prioritiesQ, movesQ, pulsesQ, threadsQ] = await Promise.all([
    sb.from("priorities").select("*").is("retired_at", null),
    sb.from("moves").select("*").in("iso_week", weeks),
    sb.from("pulses").select("*").in("iso_week", [week, prevWeek]),
    sb.from("threads").select("*").not("linked_priority_id", "is", null),
  ]);

  const priorities = (prioritiesQ.data ?? []) as (Priority & {
    blocker: string | null;
    blocker_owner_seat: SeatId | null;
  })[];
  const blockers: Record<string, { text: string; owner: SeatId } | undefined> = {};
  for (const p of priorities) {
    if (p.blocker) {
      blockers[p.id] = { text: p.blocker, owner: p.blocker_owner_seat ?? p.sponsor_seat };
    }
  }

  return derivePriorityViews(
    priorities,
    (movesQ.data ?? []) as Move[],
    (pulsesQ.data ?? []) as Pulse[],
    week,
    prevWeek,
    blockers,
    (threadsQ.data ?? []) as Thread[],
  );
}

export async function dbTable(): Promise<TableData> {
  const sb = await supabaseServer();
  const week = currentIsoWeek();
  const day = todayISO();

  const [prioritiesQ, pulsesQ, decisionsQ, receiptsQ] = await Promise.all([
    sb.from("priorities").select("*").is("retired_at", null),
    sb.from("pulses").select("*").in("iso_week", [week, isoWeekShift(week, -1)]),
    sb
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
    sb
      .from("receipts")
      .select("*")
      .in("artifact_id", [day, week]),
  ]);

  const pulses = (pulsesQ.data ?? []) as Pulse[];
  const hasThisWeek = pulses.some((p) => p.iso_week === week);
  const plotWeek = hasThisWeek ? week : isoWeekShift(week, -1);

  const receiptRows = receiptsQ.data ?? [];
  const receipts = SEAT_IDS.map((seat) => ({
    seat,
    brief: receiptRows.some(
      (r) => r.seat === seat && r.artifact_type === "brief" && r.artifact_id === day,
    ),
    pulse: receiptRows.some(
      (r) => r.seat === seat && r.artifact_type === "pulse" && r.artifact_id === week,
    ),
  }));

  const decisions = (decisionsQ.data ?? []) as Decision[];
  const decisionIds = decisions.map((d) => d.id);
  const decisionReceipts = await loadDecisionReceipts(sb, decisionIds);

  return deriveTable(
    (prioritiesQ.data ?? []) as Priority[],
    pulses,
    decisions,
    receipts,
    decisionReceipts,
    plotWeek,
    week,
  );
}

/* Who has viewed, concurred on, or fed back on each decision. Read receipts
   live in the receipts table (artifact_type 'decision'); positions live in
   decision_signoffs. Signing off implies having seen it. */
async function loadDecisionReceipts(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  decisionIds: string[],
): Promise<Record<string, DecisionReceipt>> {
  const map: Record<string, DecisionReceipt> = {};
  for (const id of decisionIds) map[id] = { seen: [], concurred: [], feedback: [] };
  if (decisionIds.length === 0) return map;

  const [seenQ, signoffQ] = await Promise.all([
    sb
      .from("receipts")
      .select("seat, artifact_id")
      .eq("artifact_type", "decision")
      .in("artifact_id", decisionIds),
    sb
      .from("decision_signoffs")
      .select("seat, decision_id, stance, note")
      .in("decision_id", decisionIds),
  ]);

  const markSeen = (id: string, seat: SeatId) => {
    const rec = map[id];
    if (rec && !rec.seen.includes(seat)) rec.seen.push(seat);
  };

  for (const r of (seenQ.data ?? []) as { seat: SeatId; artifact_id: string }[]) {
    markSeen(r.artifact_id, r.seat);
  }
  for (const s of (signoffQ.data ?? []) as {
    seat: SeatId;
    decision_id: string;
    stance: "concur" | "feedback";
    note: string | null;
  }[]) {
    const rec = map[s.decision_id];
    if (!rec) continue;
    if (s.stance === "concur") rec.concurred.push(s.seat);
    else rec.feedback.push({ seat: s.seat, note: s.note });
    markSeen(s.decision_id, s.seat);
  }
  return map;
}

export async function dbLedger(): Promise<LedgerData> {
  const sb = await supabaseServer();
  const seatQ = await sb.auth.getUser();
  const email = seatQ.data.user?.email?.toLowerCase();
  const { seatForEmail } = await import("@/lib/seats");
  const seat = email ? seatForEmail(email) : null;

  const [assumptionsQ, evidenceQ, retroQ, myReactionsQ] = await Promise.all([
    sb.from("assumptions").select("*").is("retired_at", null),
    sb
      .from("assumption_evidence")
      .select("*, signals(headline, cluster, day)")
      .order("created_at", { ascending: false }),
    sb
      .from("learn_proposals")
      .select("proposal")
      .like("week", "%:retro")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    seat
      ? sb
          .from("reactions")
          .select("subject_id, sentiment, reason_tags")
          .eq("seat", seat)
          .eq("subject_type", "assumption")
      : Promise.resolve({ data: [] as ReactionRow[] }),
  ]);

  const myReactions: Record<string, SeatReaction> = {};
  for (const r of (myReactionsQ.data ?? []) as ReactionRow[]) {
    myReactions[r.subject_id] = {
      sentiment: r.sentiment,
      tags: r.reason_tags ?? [],
    };
  }

  const evidence = evidenceQ.data ?? [];
  const retroData = retroQ.data?.proposal as { lines?: string[]; missedUrl?: string | null } | undefined;
  return {
    retro: retroData?.lines
      ? { lines: retroData.lines, missedUrl: retroData.missedUrl ?? null }
      : null,
    assumptions: (assumptionsQ.data ?? []).map((a) => ({
      id: a.id,
      statement: a.statement,
      rationale: a.rationale,
      sponsor_seat: a.sponsor_seat,
      confidence: Number(a.confidence),
      status: a.status,
      kind: a.kind ?? "assumption",
      created_at: a.created_at,
      history: a.history ?? [],
      delta30: 0,
      myReaction: myReactions[a.id] ?? null,
      evidence: evidence
        .filter((e) => e.assumption_id === a.id)
        .slice(0, 5)
        .map((e) => {
          const sig = e.signals as unknown as {
            headline: string;
            cluster: { source: string; url: string }[];
            day: string;
          } | null;
          return {
            direction: e.direction as -1 | 1,
            weight: e.weight as 1 | 2 | 3,
            headline: sig?.headline ?? "",
            source: sig?.cluster?.[0]?.source ?? "",
            url: sig?.cluster?.[0]?.url ?? "",
            day: sig?.day ?? "",
          };
        }),
    })),
  };
}

export async function dbThemes(): Promise<ThemeView[]> {
  const sb = await supabaseServer();
  const seatQ = await sb.auth.getUser();
  const email = seatQ.data.user?.email?.toLowerCase();
  const { seatForEmail } = await import("@/lib/seats");
  const seat = email ? seatForEmail(email) : null;

  const [themesQ, myReactionsQ] = await Promise.all([
    sb
      .from("themes")
      .select("id, label, lane, importance, consensus, acceleration, member_count")
      .order("importance", { ascending: false })
      .limit(6),
    seat
      ? sb
          .from("reactions")
          .select("subject_id, sentiment, reason_tags")
          .eq("seat", seat)
          .eq("subject_type", "theme")
      : Promise.resolve({ data: [] as ReactionRow[] }),
  ]);

  const myReactions: Record<string, SeatReaction> = {};
  for (const r of (myReactionsQ.data ?? []) as ReactionRow[]) {
    myReactions[r.subject_id] = { sentiment: r.sentiment, tags: r.reason_tags ?? [] };
  }

  return (
    (themesQ.data ?? []) as {
      id: string;
      label: string;
      lane: number | null;
      importance: number;
      consensus: number | null;
      acceleration: number;
      member_count: number;
    }[]
  ).map((t) => ({
    id: t.id,
    label: t.label,
    lane: t.lane,
    importance: Number(t.importance),
    consensus: t.consensus == null ? null : Number(t.consensus),
    acceleration: Number(t.acceleration ?? 0),
    member_count: t.member_count,
    myReaction: myReactions[t.id] ?? null,
  }));
}

export async function dbDecisionLog(): Promise<Decision[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  return (data ?? []) as Decision[];
}
