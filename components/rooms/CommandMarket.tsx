"use client";

/* The market, desktop-scale. On the phone the radar is one card at a time; on the
   command center a CEO wants the whole board at a glance, so this lays the day's
   signals out as a scannable list, each with its lane, its read for Amperity, and
   the same one-tap verdict. A verdict teaches the deck and clears the row, so the
   list is always "what still needs your eyes." */

import { useState } from "react";
import type { Signal } from "@/lib/types";
import { LANES } from "@/lib/copy/lanes";
import { Icon } from "@/components/ui/Icon";
import { SignalVerdict, type Intent } from "@/components/rooms/SignalVerdict";
import { signalFeedback } from "@/app/actions";

export function CommandMarket({ signals }: { signals: Signal[] }) {
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const live = signals.filter((s) => !cleared.has(s.id));

  const decide = (s: Signal, intent: Intent) => {
    setCleared((prev) => new Set(prev).add(s.id));
    void signalFeedback({
      signal_id: s.id,
      intent,
      lane: s.lane,
      headline: s.headline,
      posture: s.posture,
    });
  };

  if (live.length === 0) {
    return (
      <p className="t-secondary text-ink3">
        The board is clear. Nothing on the market needed your read today.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {live.map((s) => {
        const lane = LANES[s.lane];
        return (
          <div
            key={s.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--r-md)] border border-line bg-bg px-4 py-3"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ color: `var(${lane.cssVar})`, background: "var(--paper)" }}
            >
              <Icon name={lane.icon} size={17} strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <p className="t-body font-medium leading-snug text-ink">{s.headline}</p>
              <p className="t-label mt-0.5 line-clamp-1 text-ink3">{s.for_amperity}</p>
            </div>
            <div className="w-[280px] shrink-0">
              <SignalVerdict onChoose={(intent) => decide(s, intent)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
