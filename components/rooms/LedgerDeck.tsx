"use client";

/* The Assumption Ledger: one belief per viewport. The dial, the trend, the
   evidence, and a seat's own read when they disagree with the number. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssumptionView, RetroView } from "@/lib/data/views";
import { Dial } from "@/components/dial/Dial";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { confirm as confirmHaptic } from "@/lib/haptics";
import { voteAssumption } from "@/app/actions";

const STATUS: Record<string, { label: string; color: string }> = {
  holding: { label: "Holding", color: "var(--ink-2)" },
  strengthening: { label: "Strengthening", color: "var(--mint-deep)" },
  weakening: { label: "Weakening", color: "var(--risk)" },
  flipped: { label: "Flipped", color: "var(--risk)" },
  retired: { label: "Retired", color: "var(--ink-3)" },
};

export function LedgerDeck({
  assumptions,
  retro,
}: {
  assumptions: AssumptionView[];
  retro: RetroView | null;
}) {
  const router = useRouter();
  const [voting, setVoting] = useState<AssumptionView | null>(null);
  const [voteValue, setVoteValue] = useState(60);
  const [pending, startTransition] = useTransition();

  if (assumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-[16px] leading-relaxed text-ink2">
          The ledger is empty. The operator seeds the beliefs the strategy
          rests on, and the market argues with them from there.
        </p>
      </div>
    );
  }

  const beliefs = [...assumptions].sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === "assumption" ? -1 : 1,
  );

  return (
    <div className="snap-pager">
      {retro && (
        <div className="snap-page px-5 pb-3">
          <article className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between">
              <Chip color="var(--mint-deep)">The radar, grading itself</Chip>
              <span className="eyebrow">This week</span>
            </div>
            <div className="flex min-h-0 flex-col justify-start gap-2.5 overflow-y-auto">
              {retro.lines.map((line, i) => (
                <p
                  key={i}
                  className="text-[16px] leading-snug"
                  style={{ color: i === retro.lines.length - 1 ? "var(--ink-3)" : "var(--ink)" }}
                >
                  {line}
                </p>
              ))}
              {retro.missedUrl && (
                <a
                  href={retro.missedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-mint-deep underline underline-offset-2"
                >
                  Read the story it missed
                </a>
              )}
            </div>
          </article>
        </div>
      )}
      {beliefs.map((a) => {
        const st = STATUS[a.status] ?? STATUS.holding;
        return (
          <div key={a.id} className="snap-page px-5 pb-3">
            <article className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between">
                <Chip>{a.kind === "assumption" ? "Assumption" : "Watch item"}</Chip>
                <div className="flex items-center gap-1.5">
                  <Chip
                    onClick={() => {
                      setVoting(a);
                      setVoteValue(Math.round(a.confidence));
                    }}
                  >
                    Cast your read
                  </Chip>
                  <Chip color={st.color}>{st.label}</Chip>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Dial
                  value={a.confidence}
                  size="standard"
                  label="Confidence"
                  delta={a.delta30}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[20px] font-medium leading-snug text-ink">
                    {a.statement}
                  </h2>
                  {a.history && a.history.length > 1 && (
                    <Sparkline history={a.history} />
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                {a.rationale && (
                  <div className="flex flex-col gap-1">
                    <div className="eyebrow">Why we hold this</div>
                    <p className="text-[14px] leading-snug text-ink2">
                      {a.rationale}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <div className="eyebrow">Evidence</div>
                  {a.evidence.length === 0 ? (
                    <p className="text-[14px] leading-snug text-ink3">
                      Nothing has argued with this yet. Quiet counts as weak
                      support, so confidence drifts toward fifty until the
                      market speaks.
                    </p>
                  ) : (
                    a.evidence.map((e, i) => (
                      <a
                        key={i}
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2"
                      >
                        <span
                          className="num-display mt-0.5 text-[14px] font-semibold"
                          style={{
                            color: e.direction > 0 ? "var(--mint-deep)" : "var(--risk)",
                          }}
                        >
                          {e.direction > 0 ? "▲" : "▼"}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] leading-snug text-ink2">
                            {e.headline}
                          </span>
                          <span className="text-[12px] text-ink3">
                            {e.source} · {e.day}
                          </span>
                        </span>
                      </a>
                    ))
                  )}
                </div>
              </div>
            </article>
          </div>
        );
      })}

      <Sheet
        open={voting !== null}
        onClose={() => setVoting(null)}
        title="Your read"
      >
        {voting && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-[15px] leading-snug text-ink">{voting.statement}</p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                value={voteValue}
                onChange={(e) => setVoteValue(Number(e.target.value))}
                className="w-full accent-[var(--mint-deep)]"
              />
              <span className="num-display w-10 text-right text-[27px] font-medium">
                {voteValue}
              </span>
            </div>
            <p className="text-[13px] text-ink3">
              Your vote pulls the house number and lands in the audit trail.
            </p>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await voteAssumption({
                    id: voting.id,
                    confidence: voteValue,
                  });
                  if (res.ok) {
                    confirmHaptic();
                    setVoting(null);
                    router.refresh();
                  }
                })
              }
              className="rounded-full bg-ink py-2.5 text-[15px] font-medium text-bg disabled:opacity-60"
            >
              {pending ? "Saving" : "Cast it"}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Sparkline({ history }: { history: { day: string; confidence: number }[] }) {
  const W = 140;
  const H = 28;
  const pts = history.slice(-24);
  const min = Math.min(...pts.map((p) => p.confidence), 30);
  const max = Math.max(...pts.map((p) => p.confidence), 70);
  const path = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((p.confidence - min) / (max - min || 1)) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} className="mt-1.5" aria-label="confidence over ninety days">
      <path d={path} fill="none" stroke="var(--dial-arc, var(--mint-deep))" strokeWidth="1.5" />
    </svg>
  );
}
