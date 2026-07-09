"use client";

/* The signal deck: snap-paged cards, lane filter, one verdict control.
   A leader's single choice — not for me, worth knowing, act on it — teaches the
   deck and, on act, hands the item to the operator. The optional "why" follows. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Signal } from "@/lib/types";
import type { DeckView } from "@/lib/data/views";
import { LANES, LANE_IDS, type LaneId } from "@/lib/copy/lanes";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { SignalVerdict, type Intent } from "@/components/rooms/SignalVerdict";
import { reasonsFor } from "@/lib/copy/reasons";
import { tick } from "@/lib/haptics";
import { signalFeedback, react } from "@/app/actions";

/* Honest narration of what the sweep is actually doing, in order:
   gather → cluster → filter → score → synthesize. */
const SWEEP_STAGES = [
  "Scanning partner platforms and the category…",
  "Reading trust, capital, and agentic moves…",
  "Clustering the same story told twice…",
  "Scoring each one against the house view…",
  "Writing what it means for Amperity…",
];

export function Deck({ deck: deckView, operator }: { deck: DeckView; operator: boolean }) {
  const router = useRouter();
  const { signals, reactions, topLanes, mutedLanes } = deckView;
  const [lane, setLane] = useState<LaneId | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Signal | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    signalId: string;
    sentiment: 1 | -1;
    lane: number | null;
  } | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [active, setActive] = useState(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deck = useMemo(
    () =>
      signals.filter(
        (s) => !gone.has(s.id) && (lane == null || s.lane === lane),
      ),
    [signals, lane, gone],
  );

  /* Track which card is in view so the rail can show position — and, quietly,
     teach that the deck pages vertically. */
  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollTop / el.clientHeight);
      setActive((prev) => (prev === i ? prev : i));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [deck.length]);

  /* The single verdict. The haptic fires in the control; here we advance the
     deck, teach the learning loop, and confirm the effect in plain words. */
  const choose = (s: Signal, intent: Intent) => {
    setGone((g) => new Set(g).add(s.id));
    void signalFeedback({
      signal_id: s.id,
      intent,
      lane: s.lane,
      headline: s.headline,
      posture: s.posture,
    });
    const message =
      intent === "act"
        ? "Handed to Krish to turn into a move."
        : intent === "know"
          ? "More like this from now on."
          : "Fewer like this from now on.";
    setFeedback({
      message,
      signalId: s.id,
      sentiment: intent === "dismiss" ? -1 : 1,
      lane: s.lane,
    });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4200);
  };

  /* The optional "why", added after the choice: one reason tag, upserted onto
     the same reaction the verdict already recorded. */
  const applyWhy = (tag: string) => {
    if (!feedback) return;
    tick();
    void react({
      subject_type: "signal",
      subject_id: feedback.signalId,
      sentiment: feedback.sentiment,
      reason_tags: [tag],
      lane: feedback.lane,
    });
    setWhyOpen(false);
    setFeedback(null);
  };

  const sweep = async () => {
    setSweeping(true);
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <div className="flex gap-1.5 overflow-x-auto px-[var(--pad-x)] pb-2 [scrollbar-width:none]">
        <Chip active={lane === null} onClick={() => setLane(null)}>
          All lanes
        </Chip>
        {LANE_IDS.map((id) => (
          <Chip
            key={id}
            active={lane === id}
            icon={LANES[id].icon}
            onClick={() => {
              tick();
              setLane(lane === id ? null : id);
            }}
          >
            {LANES[id].glyph}
          </Chip>
        ))}
      </div>

      {sweeping ? (
        <SweepingDeck />
      ) : deck.length === 0 ? (
        <div className="room-canvas items-center justify-center gap-4 px-8 text-center">
          <p className="t-lede leading-relaxed text-ink2">
            Nothing more from the market today. A quiet day, which happens.
          </p>
          {operator && (
            <Button size="sm" onClick={sweep}>
              Run a sweep now
            </Button>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-col">
          {(topLanes.length > 0 || mutedLanes.length > 0) && (
            <LearnedBanner topLanes={topLanes} mutedLanes={mutedLanes} />
          )}
          <div className="relative min-h-0 flex-1">
            <div className="snap-pager" ref={pagerRef}>
              {deck.map((s, i) => (
                <SignalCard
                  key={s.id}
                  signal={s}
                  index={i}
                  total={deck.length}
                  onSources={() => setSources(s)}
                  onChoose={(intent) => choose(s, intent)}
                />
              ))}
            </div>
            {deck.length > 1 && <PageRail total={deck.length} active={active} />}
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-[var(--pad-x)]">
          <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-[14px] text-bg shadow-[var(--elev-card)]">
            <span>{feedback.message}</span>
            <button
              onClick={() => {
                tick();
                setWhyOpen(true);
              }}
              className="underline underline-offset-2 opacity-80"
            >
              why?
            </button>
          </div>
        </div>
      )}

      <Sheet open={whyOpen} onClose={() => setWhyOpen(false)} title="Add a reason">
        <div className="flex flex-col gap-3 pt-1">
          <p className="t-secondary text-ink3">
            Optional. It sharpens what the deck learns for you.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {feedback &&
              reasonsFor("signal", feedback.sentiment).map((c) => (
                <button
                  key={c.tag}
                  onClick={() => applyWhy(c.tag)}
                  className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink2"
                >
                  {c.label}
                </button>
              ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={sources !== null} onClose={() => setSources(null)} title="Sources">
        <div className="flex flex-col gap-2 pt-1">
          {sources?.cluster.map((c, i) => (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--r-md)] border border-line px-3 py-2.5"
            >
              <div className="t-secondary font-medium leading-snug text-ink">
                {c.title}
              </div>
              <div className="t-label mt-0.5 text-ink3">{c.source}</div>
            </a>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* A vertical rail of dots on the right edge: which card you're on, and that
   there are more below. Purely a wayfinding hint. */
function PageRail({ total, active }: { total: number; active: number }) {
  return (
    <div className="pointer-events-none absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-200"
          style={{
            width: 5,
            height: i === active ? 16 : 5,
            background: i === active ? "var(--mint-deep)" : "var(--line)",
          }}
        />
      ))}
    </div>
  );
}

/* Reflects the learning back: a quiet line, top of deck, naming what the radar
   is leaning into for this leader and what it's quieting. Makes the
   personalization legible instead of magic. */
function LearnedBanner({
  topLanes,
  mutedLanes,
}: {
  topLanes: number[];
  mutedLanes: number[];
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const names = (ids: number[]) =>
    ids.map((id) => LANES[id as LaneId].glyph).join(", ");
  return (
    <div className="mx-[var(--pad-x)] mb-2 flex items-center gap-2 rounded-[var(--r-pill)] border border-line bg-paper px-3 py-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint-deep)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z" />
      </svg>
      <span className="t-label min-w-0 flex-1 truncate text-ink2">
        {topLanes.length > 0 && <>Leading with {names(topLanes)}</>}
        {topLanes.length > 0 && mutedLanes.length > 0 && " · "}
        {mutedLanes.length > 0 && <>quieting {names(mutedLanes)}</>}
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-ink3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/* The sweep in progress: skeleton cards that page vertically, so the shape and
   the scroll are obvious before anything lands, plus honest narration of the
   stage the pipeline is on. */
function SweepingDeck() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStage((s) => (s + 1) % SWEEP_STAGES.length),
      2400,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-0 overflow-hidden">
      <div className="flex h-full flex-col gap-3 px-[var(--pad-x)] pt-1">
        <SkeletonCard live>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner />
            <p className="t-lede text-ink">Sweeping the market</p>
            <p className="t-secondary min-h-[2.4em] text-ink3 transition-opacity duration-300">
              {SWEEP_STAGES[stage]}
            </p>
            <span className="eyebrow mt-1">This takes about a minute</span>
          </div>
        </SkeletonCard>
        {/* A peek of the next card, so the vertical stack reads immediately. */}
        <div className="h-24 shrink-0">
          <SkeletonCard />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
        <span className="eyebrow flex items-center gap-1 text-ink3">
          Cards stack below
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function SkeletonCard({
  children,
  live,
}: {
  children?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-[var(--r-lg)] border border-line bg-paper p-4 shadow-[var(--elev-card)] ${live ? "flex-1" : "h-full"}`}
    >
      <div className="flex gap-1.5">
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
      </div>
      <Shimmer className="h-6 w-4/5 rounded" />
      <Shimmer className="h-6 w-3/5 rounded" />
      {children}
      {!children && (
        <div className="mt-2 flex flex-col gap-2">
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-11/12 rounded" />
        </div>
      )}
    </div>
  );
}

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block ${className}`}
      style={{
        background:
          "linear-gradient(90deg, var(--line) 0%, var(--bg) 50%, var(--line) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

function Spinner() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" className="animate-spin" style={{ animationDuration: "0.9s" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line)" strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="var(--mint-deep)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SignalCard({
  signal: s,
  index,
  total,
  onSources,
  onChoose,
}: {
  signal: Signal;
  index: number;
  total: number;
  onSources: () => void;
  onChoose: (intent: Intent) => void;
}) {
  const lane = LANES[s.lane];
  const challenges = s.assumption_id != null && s.assumption_direction === -1;
  const edgeColor = challenges ? "var(--risk)" : `var(${lane.cssVar})`;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  /* Long press reads the card aloud; the text is already on screen. */
  const readAloud = async () => {
    if (speaking) return;
    setSpeaking(true);
    tick();
    try {
      const text = `${s.headline}. For Amperity: ${s.for_amperity}${s.posture ? ` The move: ${s.posture}` : ""}`;
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok && audioRef.current) {
        const { url } = (await res.json()) as { url: string };
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } finally {
      setSpeaking(false);
    }
  };

  const pressStart = () => {
    holdTimer.current = setTimeout(() => void readAloud(), 650);
  };
  const pressEnd = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  return (
    <div className="snap-page px-[var(--pad-x)] pb-3">
      {/* A fixed three-row grid: the chrome and the one control are pinned, and
         only the middle body scrolls if it must. This keeps every card inside
         its own page, so a long story can never bleed onto the next card. */}
      <article
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-[var(--r-lg)] border border-line bg-paper p-[var(--space-5)] shadow-[var(--elev-card)]"
        style={{ borderLeft: `3px solid ${edgeColor}` }}
      >
        <audio ref={audioRef} className="hidden" />

        {/* Pinned header: lane, corroboration, position. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Chip color={`var(${lane.cssVar})`} icon={lane.icon}>{lane.glyph}</Chip>
            <Chip>
              {s.corroboration} source{s.corroboration === 1 ? "" : "s"}
            </Chip>
            {s.illustrative && <Chip>Sample</Chip>}
          </div>
          <span className="eyebrow shrink-0 text-ink3">
            {index + 1} / {total}
          </span>
        </div>

        {/* The body shows the full read. Most cards fit with room to spare; a rare
           long one scrolls here without truncating anything. Crucially it does NOT
           set overscroll-behavior: contain, so once the body is at its edge (or has
           nothing to scroll) a swipe chains to the pager and moves to the next card
           from anywhere on the card, not only the footer. */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto [scrollbar-width:none]">
          <h2 className="t-headline text-ink">{s.headline}</h2>
          <div>
            <div className="eyebrow mb-1">For Amperity</div>
            <p className="t-body text-ink2">{s.for_amperity}</p>
          </div>
          {s.posture && (
            <div>
              <div className="eyebrow mb-1">The move</div>
              <p className="t-body text-ink">{s.posture}</p>
            </div>
          )}
          {s.assumption_id && s.assumption_direction != null && s.assumption_direction !== 0 && (
            <Link href="/ledger" className="inline-flex">
              <Chip
                color={s.assumption_direction > 0 ? "var(--mint-deep)" : "var(--risk)"}
                filled={s.assumption_direction < 0}
              >
                {s.assumption_direction > 0
                  ? "▲ supports our thinking"
                  : "▼ counter-signal · threatens the moat"}
              </Chip>
            </Link>
          )}
          <button
            onClick={onSources}
            className="self-start text-[var(--t-label)] text-ink3 underline underline-offset-2"
          >
            {s.cluster
              .slice(0, 3)
              .map((c) => c.source)
              .join(", ")}
          </button>
        </div>

        {/* Pinned footer: the one clear thing to decide. */}
        <div className="border-t border-line pt-3">
          <div className="eyebrow mb-2 text-center">What is this to you?</div>
          <SignalVerdict onChoose={onChoose} />
        </div>
      </article>
    </div>
  );
}
