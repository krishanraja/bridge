"use client";

/* The universal feedback primitive. One tap — thumb up or down — records a
   position instantly (haptic), then offers a short set of intelligent reason
   chips so the leader can say why in a second more, if they want to. Drops onto
   any object: a radar signal, a decision, a brief, a move, a belief.

   Feedback lands attributed to the seat and the subject, and teaches the app
   what this leader cares about. Sentiment saves on the first tap; reasons are
   always optional. */

import { useState, useTransition } from "react";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { react } from "@/app/actions";
import { reasonsFor, type ReactionSubject } from "@/lib/copy/reasons";

export interface ReactionState {
  sentiment: 1 | -1;
  tags: string[];
}

export function Reaction({
  subjectType,
  subjectId,
  lane,
  initial,
  prompt = "Useful to you?",
  onChange,
}: {
  subjectType: ReactionSubject;
  subjectId: string;
  lane?: number | null;
  initial?: ReactionState | null;
  prompt?: string;
  onChange?: (s: ReactionState | null) => void;
}) {
  const [sentiment, setSentiment] = useState<1 | -1 | null>(
    initial?.sentiment ?? null,
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const save = (s: 1 | -1, nextTags: string[]) => {
    startTransition(async () => {
      await react({
        subject_type: subjectType,
        subject_id: subjectId,
        sentiment: s,
        reason_tags: nextTags,
        lane: lane ?? null,
      });
    });
    onChange?.({ sentiment: s, tags: nextTags });
  };

  const pick = (s: 1 | -1) => {
    if (sentiment === s) {
      setOpen((o) => !o);
      return;
    }
    (s > 0 ? confirmHaptic : tick)();
    setSentiment(s);
    setTags([]);
    setOpen(true);
    save(s, []);
  };

  const toggleTag = (tag: string) => {
    if (!sentiment) return;
    tick();
    const next = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    setTags(next);
    save(sentiment, next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="eyebrow text-ink3">{prompt}</span>
        <div className="flex items-center gap-1.5">
          <ThumbButton dir="up" active={sentiment === 1} onClick={() => pick(1)} />
          <ThumbButton dir="down" active={sentiment === -1} onClick={() => pick(-1)} />
        </div>
        {sentiment != null && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="eyebrow text-ink3 underline underline-offset-2"
          >
            {tags.length
              ? `${tags.length} reason${tags.length > 1 ? "s" : ""}`
              : open
                ? "hide"
                : "why?"}
          </button>
        )}
      </div>
      {sentiment != null && open && (
        <div className="flex flex-wrap gap-1.5">
          {reasonsFor(subjectType, sentiment).map((c) => {
            const on = tags.includes(c.tag);
            return (
              <button
                key={c.tag}
                onClick={() => toggleTag(c.tag)}
                className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
                style={
                  on
                    ? {
                        background: "var(--mint-wash)",
                        borderColor: "var(--mint-bd)",
                        color: "var(--ink)",
                      }
                    : { borderColor: "var(--line)", color: "var(--ink-2)" }
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThumbButton({
  dir,
  active,
  onClick,
}: {
  dir: "up" | "down";
  active: boolean;
  onClick: () => void;
}) {
  const color = active
    ? dir === "up"
      ? "var(--mint-deep)"
      : "var(--risk)"
    : "var(--ink-3)";
  const bg = active
    ? dir === "up"
      ? "var(--mint-wash)"
      : "var(--risk-wash)"
    : "transparent";
  return (
    <button
      onClick={onClick}
      aria-label={dir === "up" ? "Useful" : "Not useful"}
      aria-pressed={active}
      className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
      style={{ borderColor: active ? color : "var(--line)", background: bg }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={dir === "down" ? { transform: "rotate(180deg)" } : undefined}
      >
        <path d="M7 10v11" />
        <path d="M7 10l4-7a2.2 2.2 0 0 1 3 2l-1 5h4.5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 21H7" />
      </svg>
    </button>
  );
}
