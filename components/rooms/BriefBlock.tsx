"use client";

/* The play block. Audio when a rendered brief exists; the text twin is always
   one tap away, carrying the citation chips that trace each line to its record. */

import { useRef, useState } from "react";
import type { BriefView } from "@/lib/data/views";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { tick } from "@/lib/haptics";
import { markBriefSeen } from "@/app/actions";

function BriefText({ brief }: { brief: BriefView }) {
  const lines = brief.script.split("\n").filter((l) => l.trim().length > 0);
  const refsForLine = (raw: string): { label: string; url: string | null }[] => {
    const codes = [...raw.matchAll(/\[([A-Z]\d+)\]/g)].map((m) => m[1]);
    return codes
      .map((c) => brief.refLabels[c])
      .filter((r): r is { label: string; url: string | null } => Boolean(r));
  };
  const HEADERS = /^(Market|Our thinking|The week|The call)\b/i;

  return (
    <div className="flex flex-col gap-3 pt-1">
      {lines.map((line, i) => {
        const clean = line.replace(/\s*\[[A-Z]\d+\]/g, "").trim();
        const cites = refsForLine(line);
        if (HEADERS.test(clean) && clean.length < 16) {
          return (
            <div key={i} className="eyebrow pt-1">
              {clean}
            </div>
          );
        }
        return (
          <div key={i} className="flex flex-col gap-1">
            <p className="text-[16px] leading-relaxed text-ink">{clean}</p>
            {cites.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cites.map((c, j) =>
                  c.url ? (
                    <a key={j} href={c.url} target="_blank" rel="noopener noreferrer">
                      <Chip>{c.label.slice(0, 30)}</Chip>
                    </a>
                  ) : (
                    <Chip key={j}>{c.label.slice(0, 30)}</Chip>
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BriefBlock({ brief }: { brief: BriefView | null }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenRef = useRef(false);

  const markSeen = () => {
    if (seenRef.current || !brief) return;
    seenRef.current = true;
    void markBriefSeen(brief.day);
  };

  if (!brief) {
    return (
      <section className="mx-5 flex flex-col items-center justify-center rounded-xl border border-line bg-paper px-6 py-4 text-center">
        <p className="text-[14px] leading-snug text-ink3">
          The morning read is not ready yet. It lands each weekday around half past seven.
        </p>
      </section>
    );
  }

  const hasAudio = Boolean(brief.audioPath);

  const onPress = () => {
    tick();
    markSeen();
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
          onClick={() => {
            markSeen();
            setOpen(true);
          }}
          className="mt-0.5 text-[14px] text-ink3 underline underline-offset-2"
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
        <BriefText brief={brief} />
      </Sheet>
    </section>
  );
}
