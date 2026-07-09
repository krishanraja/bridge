"use client";

/* The Settings entry to the setup wizard. It shows the current "how to work with
   them" summary and lets a person reopen the wizard on any single card, so a
   quick change never means walking the whole thing again. */

import { useState } from "react";
import Link from "next/link";
import { CORE_CARDS } from "@/lib/copy/prefs";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { tick } from "@/lib/haptics";

export function PrefsEntry({
  summary,
  name,
}: {
  summary: string | null;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const editable = CORE_CARDS.filter((c) => !c.seatPicker);

  return (
    <section className="mx-5 rounded-xl border border-line bg-paper p-3.5">
      <div className="eyebrow mb-2">How {name} likes to work</div>
      {summary ? (
        <p className="t-secondary leading-relaxed text-ink2">{summary}</p>
      ) : (
        <p className="t-secondary text-ink3">Not set up yet.</p>
      )}
      <div className="mt-3 flex gap-2">
        <Link
          href="/setup?from=settings"
          className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-line px-3.5 py-1.5 text-[14px] font-medium text-ink2"
        >
          {summary ? "Run it again" : "Set it up"}
        </Link>
        {summary && (
          <button
            onClick={() => {
              tick();
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-line px-3.5 py-1.5 text-[14px] font-medium text-ink2"
          >
            Change one answer
          </button>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Change one answer">
        <div className="flex flex-col gap-1.5 pt-1">
          {editable.map((c) => (
            <Link
              key={c.field}
              href={`/setup?card=${c.field}&from=settings`}
              className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-line px-3 py-2.5 text-left"
            >
              <span className="t-secondary text-ink">{c.question}</span>
              <Icon name="chevron-right" size={15} className="shrink-0 text-ink3" />
            </Link>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
