"use client";

/* The operator's Sunday review. The system proposes; the operator releases.
   Approve applies the weights and lane order; skip changes nothing. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

export interface StagedProposal {
  id: number;
  summary: string;
  sourceWeights: { name: string; from: number; to: number }[];
  laneCount: number;
  styleMemo: string | null;
}

export function LearnReview({ proposal }: { proposal: StagedProposal | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (!proposal) return null;

  const decide = (decision: "approve" | "skip") =>
    startTransition(async () => {
      if (decision === "approve") confirmHaptic();
      else tick();
      const res = await fetch("/api/learn/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: proposal.id, decision }),
      });
      if (res.ok) {
        setDone(decision === "approve" ? "Applied. The radar learns from here." : "Skipped. Nothing moved.");
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <section className="mx-5 rounded-xl border border-mint-bd bg-mint-wash px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-3">
          <div className="eyebrow">The week's learning, staged</div>
          <p className="truncate text-[11px] text-ink2">{done ?? proposal.summary}</p>
        </div>
        {!done && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-medium text-bg"
          >
            Review
          </button>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="This week's learning">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[13px] leading-snug text-ink">{proposal.summary}</p>

          {proposal.sourceWeights.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="eyebrow">Source trust</div>
              {proposal.sourceWeights.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-[12px]">
                  <span className="text-ink2">{s.name}</span>
                  <span
                    className="num-display"
                    style={{ color: s.to > s.from ? "var(--mint-deep)" : "var(--risk)" }}
                  >
                    {s.from.toFixed(2)} to {s.to.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {proposal.laneCount > 0 && (
            <p className="text-[12px] text-ink2">
              Lane order retuned for {proposal.laneCount} seat
              {proposal.laneCount === 1 ? "" : "s"} from how they engaged.
            </p>
          )}

          {proposal.styleMemo && (
            <div>
              <div className="eyebrow mb-0.5">Composer note</div>
              <p className="text-[12px] leading-snug text-ink2">{proposal.styleMemo}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              disabled={pending}
              onClick={() => decide("approve")}
              className="flex-1 rounded-full bg-ink py-2.5 text-[13px] font-medium text-bg disabled:opacity-60"
            >
              Approve
            </button>
            <button
              disabled={pending}
              onClick={() => decide("skip")}
              className="rounded-full border border-line px-5 py-2.5 text-[12px] text-ink2"
            >
              Skip
            </button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
