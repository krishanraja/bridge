"use client";

/* The signal deck: snap-paged cards, lane filter, three actions.
   Act, Hold, Kill act on the local deal now; they feed the learning loop at gate two. */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Signal } from "@/lib/types";
import { LANES, LANE_IDS, type LaneId } from "@/lib/copy/lanes";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { signalVerdict } from "@/app/actions";

export function Deck({ signals, operator }: { signals: Signal[]; operator: boolean }) {
  const router = useRouter();
  const [lane, setLane] = useState<LaneId | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Signal | null>(null);
  const [acted, setActed] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const deck = useMemo(
    () =>
      signals.filter(
        (s) => !gone.has(s.id) && (lane == null || s.lane === lane),
      ),
    [signals, lane, gone],
  );

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
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
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

      {deck.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[14px] leading-relaxed text-ink2">
            Quiet in the market today. The pipeline found nothing more that
            clears the bar. That is a fact, not a failure.
          </p>
          {operator && (
            <button
              onClick={sweep}
              disabled={sweeping}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-bg disabled:opacity-60"
            >
              {sweeping ? "Sweeping. This takes a minute." : "Run a sweep now"}
            </button>
          )}
        </div>
      ) : (
        <div className="snap-pager">
          {deck.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              onSources={() => setSources(s)}
              onAction={dismiss}
            />
          ))}
        </div>
      )}

      {acted && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-[12px] text-bg">
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
              className="rounded-lg border border-line px-3 py-2.5"
            >
              <div className="text-[12px] font-medium leading-snug text-ink">
                {c.title}
              </div>
              <div className="mt-0.5 text-[10.5px] text-ink3">{c.source}</div>
            </a>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function SignalCard({
  signal: s,
  onSources,
  onAction,
}: {
  signal: Signal;
  onSources: () => void;
  onAction: (id: string, kind: "act" | "hold" | "kill") => void;
}) {
  const lane = LANES[s.lane];
  return (
    <div className="snap-page px-5 pb-3">
      <article
        className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto_auto] gap-2 rounded-xl border border-line bg-paper p-4"
        style={{ borderLeft: `3px solid var(${lane.cssVar})` }}
      >
        <div className="flex items-center gap-1.5">
          <Chip color={`var(${lane.cssVar})`}>{lane.glyph}</Chip>
          <Chip>
            {s.corroboration} source{s.corroboration === 1 ? "" : "s"}
          </Chip>
          {s.illustrative && <Chip>Sample</Chip>}
        </div>

        <h2 className="num-display text-[20px] font-medium leading-tight text-ink">
          {s.headline}
        </h2>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <div>
            <div className="eyebrow mb-0.5">For Amperity</div>
            <p className="text-[13px] leading-snug text-ink2">{s.for_amperity}</p>
          </div>
          {s.posture && (
            <div>
              <div className="eyebrow mb-0.5">The move</div>
              <p className="text-[13px] leading-snug text-ink">{s.posture}</p>
            </div>
          )}
          {s.assumption_id && s.assumption_direction != null && s.assumption_direction !== 0 && (
            <Link href="/ledger" className="inline-flex">
              <Chip
                color={
                  s.assumption_direction > 0 ? "var(--mint-deep)" : "var(--risk)"
                }
              >
                {s.assumption_direction > 0 ? "▲ supports" : "▼ challenges"} the
                house view
              </Chip>
            </Link>
          )}
        </div>

        <button
          onClick={onSources}
          className="flex items-center gap-1.5 text-[10.5px] text-ink3 underline underline-offset-2"
        >
          {s.cluster
            .slice(0, 3)
            .map((c) => c.source)
            .join(", ")}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onAction(s.id, "act")}
            className="rounded-full bg-ink py-2 text-[12px] font-medium text-bg"
          >
            Act
          </button>
          <button
            onClick={() => onAction(s.id, "hold")}
            className="rounded-full border border-line py-2 text-[12px] font-medium text-ink2"
          >
            Hold
          </button>
          <button
            onClick={() => onAction(s.id, "kill")}
            className="rounded-full border border-line py-2 text-[12px] font-medium text-ink3"
          >
            Kill
          </button>
        </div>
      </article>
    </div>
  );
}
