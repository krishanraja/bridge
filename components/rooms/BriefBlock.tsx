"use client";

/* The play block. Audio when a rendered brief exists; the text twin is always one tap away. */

import { useRef, useState } from "react";
import type { BriefView } from "@/lib/data/views";
import { Sheet } from "@/components/ui/Sheet";
import { tick } from "@/lib/haptics";

export function BriefBlock({ brief }: { brief: BriefView | null }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!brief) {
    return (
      <section className="mx-5 flex flex-col items-center justify-center rounded-xl border border-line bg-paper px-6 py-4 text-center">
        <p className="text-[12px] leading-snug text-ink3">
          No brief yet. The composer runs at 06:45 and the morning read lands at
          07:30.
        </p>
      </section>
    );
  }

  const hasAudio = Boolean(brief.audioPath);

  const onPress = () => {
    tick();
    if (!hasAudio) {
      setOpen(true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  return (
    <section className="mx-5 flex min-h-0 flex-col items-center justify-center gap-3 px-6">
      <button
        onClick={onPress}
        aria-label={hasAudio ? "Play the brief" : "Read the brief"}
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          boxShadow: "0 0 0 8px var(--mint-wash), 0 0 0 9px var(--mint-bd)",
        }}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="4" y="3" width="4" height="14" rx="1" />
            <rect x="12" y="3" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 3.5v13l11-6.5z" />
          </svg>
        )}
      </button>
      <div className="text-center">
        <div className="eyebrow">The morning read</div>
        <button
          onClick={() => setOpen(true)}
          className="mt-0.5 text-[12px] text-ink3 underline underline-offset-2"
        >
          Read it instead
        </button>
      </div>
      {hasAudio && (
        <audio
          ref={audioRef}
          src={brief.audioPath!}
          onEnded={() => setPlaying(false)}
          preload="none"
        />
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="The morning read">
        <div className="flex flex-col gap-3 pt-1">
          {brief.script.split("\n\n").map((para, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-ink">
              {para}
            </p>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
