"use client";

/* The signal deck: snap-paged cards, lane filter, three actions.
   Act, Hold, Kill act on the local deal now; they feed the learning loop at gate two. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Signal } from "@/lib/types";
import type { DeckView, SeatReaction } from "@/lib/data/views";
import { LANES, LANE_IDS, type LaneId } from "@/lib/copy/lanes";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Reaction } from "@/components/ui/Reaction";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { signalVerdict } from "@/app/actions";

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
  const [acted, setActed] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [active, setActive] = useState(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);

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

  const dismiss = (id: string, kind: "act" | "hold" | "kill") => {
    if (kind === "act") confirmHaptic();
    else tick();
    setGone((g) => new Set(g).add(id));
    void signalVerdict({ signal_id: id, kind });
    if (kind === "act") {
      setActed("Routed to the operator as a draft move.");
      setTimeout(() => setActed(null), 2600);
    }
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
        <div className="relative min-h-0">
          <div className="snap-pager" ref={pagerRef}>
            {deck.map((s, i) => (
              <SignalCard
                key={s.id}
                signal={s}
                index={i}
                total={deck.length}
                reaction={reactions[s.id] ?? null}
                onSources={() => setSources(s)}
                onAction={dismiss}
              />
            ))}
          </div>
          {deck.length > 1 && <PageRail total={deck.length} active={active} />}
          {(topLanes.length > 0 || mutedLanes.length > 0) && (
            <LearnedBanner topLanes={topLanes} mutedLanes={mutedLanes} />
          )}
        </div>
      )}

      {acted && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-[14px] text-bg">
            {acted}
          </span>
        </div>
      )}

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
    <div className="pointer-events-auto absolute inset-x-[var(--pad-x)] top-1 z-10 flex items-center gap-2 rounded-[var(--r-pill)] border border-line bg-paper/95 px-3 py-1.5 shadow-[var(--elev-card)] backdrop-blur">
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
  reaction,
  onSources,
  onAction,
}: {
  signal: Signal;
  index: number;
  total: number;
  reaction: SeatReaction | null;
  onSources: () => void;
  onAction: (id: string, kind: "act" | "hold" | "kill") => void;
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
      <article
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        className="flex h-full min-h-0 flex-col gap-3 rounded-[var(--r-lg)] border border-line bg-paper p-[var(--space-5)] shadow-[var(--elev-card)]"
        style={{ borderLeft: `3px solid ${edgeColor}` }}
      >
        <audio ref={audioRef} className="hidden" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Chip color={`var(${lane.cssVar})`}>{lane.glyph}</Chip>
            <Chip>
              {s.corroboration} source{s.corroboration === 1 ? "" : "s"}
            </Chip>
            {s.illustrative && <Chip>Sample</Chip>}
          </div>
          <span className="eyebrow shrink-0 text-ink3">
            {index + 1} / {total}
          </span>
        </div>

        <h2 className="t-headline text-ink">{s.headline}</h2>

        {/* Content flows on the rhythm grid; the action bar is pinned to the
           bottom with mt-auto — no dead 1fr gap. */}
        <div className="flex flex-col gap-3">
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
        </div>

        <button
          onClick={onSources}
          className="flex items-center gap-1.5 text-[var(--t-label)] text-ink3 underline underline-offset-2"
        >
          {s.cluster
            .slice(0, 3)
            .map((c) => c.source)
            .join(", ")}
        </button>

        {/* The universal feedback primitive. Teaches the deck this leader's
           taste; separate from the Act/Hold/Kill triage below. */}
        <div className="mt-auto border-t border-line pt-3">
          <Reaction
            subjectType="signal"
            subjectId={s.id}
            lane={s.lane}
            initial={reaction}
            prompt="Matters to you?"
          />
        </div>

        {/* Act/Hold/Kill triage in the thumb zone. */}
        <div className="grid grid-cols-3 gap-2 pt-3">
          <button
            onClick={() => onAction(s.id, "act")}
            className="rounded-[var(--r-pill)] bg-ink py-2.5 text-[var(--t-secondary)] font-medium text-bg"
          >
            Act
          </button>
          <button
            onClick={() => onAction(s.id, "hold")}
            className="rounded-[var(--r-pill)] border border-line py-2.5 text-[var(--t-secondary)] font-medium text-ink2"
          >
            Hold
          </button>
          <button
            onClick={() => onAction(s.id, "kill")}
            className="rounded-[var(--r-pill)] border border-line py-2.5 text-[var(--t-secondary)] font-medium text-ink3"
          >
            Kill
          </button>
        </div>
      </article>
    </div>
  );
}
