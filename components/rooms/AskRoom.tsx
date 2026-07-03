"use client";

/* Ask: the push-to-talk surface. The voice pipeline arrives at gate three;
   until then the room states its grammar and stays honest about what is wired. */

import { useState } from "react";
import { tick } from "@/lib/haptics";
import { Sheet } from "@/components/ui/Sheet";

const GRAMMAR = [
  "Log a decision",
  "Set this week's move on a priority",
  "What changed on a lane this week",
  "Where do we disagree",
  "Brief me on a company",
];

export function AskRoom() {
  const [info, setInfo] = useState(false);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] pb-4">
      <header className="px-5 pt-4">
        <div className="eyebrow">Ask</div>
      </header>

      <div className="flex flex-col items-center justify-center gap-5 px-8">
        <button
          onPointerDown={() => {
            tick();
            setInfo(true);
          }}
          aria-label="Hold to talk"
          className="flex h-28 w-28 items-center justify-center rounded-full border-2"
          style={{ borderColor: "var(--ink)", background: "var(--paper)" }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
            <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
          </svg>
        </button>
        <p className="text-center text-[13px] leading-snug text-ink2">
          Hold to talk. Ask anything grounded in the house context, or speak a
          command.
        </p>
      </div>

      <div className="px-8">
        <div className="eyebrow mb-1.5 text-center">The grammar</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {GRAMMAR.map((g) => (
            <span
              key={g}
              className="rounded-full border border-line px-2.5 py-0.5 text-[10.5px] text-ink3"
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      <Sheet open={info} onClose={() => setInfo(false)} title="Ask">
        <p className="pt-1 text-[14px] leading-relaxed text-ink">
          The voice room is not wired yet. It arrives at gate three: hold to
          talk, grounded answers with sources, and decisions logged by voice
          with a confirm card. The screen you are looking at is the finished
          surface.
        </p>
      </Sheet>
    </div>
  );
}
