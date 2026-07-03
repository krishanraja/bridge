"use client";

/* The Assumption Ledger: one belief per viewport. The dial, the trend, the evidence. */

import type { AssumptionView } from "@/lib/data/views";
import { Dial } from "@/components/dial/Dial";
import { Chip } from "@/components/ui/Chip";

const STATUS: Record<string, { label: string; color: string }> = {
  holding: { label: "Holding", color: "var(--ink-2)" },
  strengthening: { label: "Strengthening", color: "var(--mint-deep)" },
  weakening: { label: "Weakening", color: "var(--risk)" },
  flipped: { label: "Flipped", color: "var(--risk)" },
  retired: { label: "Retired", color: "var(--ink-3)" },
};

export function LedgerDeck({ assumptions }: { assumptions: AssumptionView[] }) {
  if (assumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-[14px] leading-relaxed text-ink2">
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
      {beliefs.map((a) => {
        const st = STATUS[a.status] ?? STATUS.holding;
        return (
          <div key={a.id} className="snap-page px-5 pb-3">
            <article className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between">
                <Chip>{a.kind === "assumption" ? "Assumption" : "Watch item"}</Chip>
                <Chip color={st.color}>{st.label}</Chip>
              </div>

              <div className="flex items-center gap-4">
                <Dial
                  value={a.confidence}
                  size="standard"
                  label="Confidence"
                  delta={a.delta30}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-medium leading-snug text-ink">
                    {a.statement}
                  </h2>
                  {a.history && a.history.length > 1 && (
                    <Sparkline history={a.history} />
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
                <div className="eyebrow">Evidence</div>
                {a.evidence.length === 0 ? (
                  <p className="text-[12px] leading-snug text-ink3">
                    Nothing has argued with this yet. Quiet counts as weak
                    support, so confidence drifts toward fifty until the market
                    speaks.
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
                        className="num-display mt-0.5 text-[12px] font-semibold"
                        style={{
                          color: e.direction > 0 ? "var(--mint-deep)" : "var(--risk)",
                        }}
                      >
                        {e.direction > 0 ? "▲" : "▼"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] leading-snug text-ink2">
                          {e.headline}
                        </span>
                        <span className="text-[10.5px] text-ink3">
                          {e.source} · {e.day}
                        </span>
                      </span>
                    </a>
                  ))
                )}
              </div>
            </article>
          </div>
        );
      })}
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
