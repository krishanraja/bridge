"use client";

/* The table's alignment, read at a glance. The plot places each priority by the
   table's confidence and how far apart the seats sit; tapping a dot names it and
   shows who is high and who is low, so the widest split is one click from the
   picture. Reuses the phone Table's plot, unchanged. */

import { useState } from "react";
import type { TableData } from "@/lib/data/views";
import { SEATS } from "@/lib/seats";
import { AlignmentPlot } from "@/components/rooms/AlignmentPlot";
import { tick } from "@/lib/haptics";

export function CommandAlignment({ data }: { data: TableData }) {
  const [selected, setSelected] = useState<string | null>(
    data.plot[0]?.priorityId ?? null,
  );
  const point = data.plot.find((p) => p.priorityId === selected) ?? data.plot[0];
  const ordered = point ? [...point.votes].sort((a, b) => b.confidence - a.confidence) : [];

  return (
    <div className="flex flex-col gap-3">
      <AlignmentPlot
        data={data}
        onDot={(id) => {
          tick();
          setSelected(id);
        }}
      />
      {point && (
        <div className="rounded-[var(--r-md)] border border-line bg-bg px-3.5 py-3">
          <p className="t-body font-medium text-ink">{point.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {ordered.map((v) => (
              <span key={v.seat} className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink3">
                  {SEATS[v.seat].initials}
                </span>
                <span className="num-display text-[14px] font-medium text-ink">
                  {v.confidence}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
