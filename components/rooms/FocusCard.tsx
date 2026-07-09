"use client";

/* The one clear thing. Today's single focus, promoted to the hero: a large
   iconographic card that names Bridge's pick, why it picked it, how it lands in
   the viewer's lane, and one primary action. This is the app's whole thesis in
   one surface, the app doing a leader's prioritisation for them. */

import Link from "next/link";
import type { FocusItem } from "@/lib/types";
import type { SeatId } from "@/lib/seats";
import { LANES } from "@/lib/copy/lanes";
import { seatFraming } from "@/lib/copy/styles";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { impact } from "@/lib/haptics";

const KIND_ICON: Record<FocusItem["kind"], IconName> = {
  decision: "decision",
  move: "move",
  signal: "signal",
  thread: "thread",
};

export function FocusCard({
  focus,
  seat,
}: {
  focus: FocusItem;
  seat: SeatId;
}) {
  const laneColor = focus.lane != null ? `var(${LANES[focus.lane].cssVar})` : "var(--mint-deep)";
  const framing = seatFraming(seat, focus.lane);
  const why = [focus.reason, framing].filter(Boolean).join(" ");

  return (
    <Card
      accent={laneColor}
      className="rise flex flex-col gap-[var(--space-4)]"
      style={{ padding: "var(--space-5)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="pop flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "var(--mint-wash)",
            border: "1px solid var(--mint-bd)",
            color: "var(--mint-deep)",
          }}
        >
          <Icon name={KIND_ICON[focus.kind]} size={26} strokeWidth={1.7} />
        </span>
        <span className="eyebrow flex items-center gap-1.5" style={{ color: "var(--mint-deep)" }}>
          <Icon name="sparkle" size={14} strokeWidth={1.6} />
          Bridge suggests
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="t-headline text-ink">{focus.text}</h2>
        {why && <p className="t-secondary text-ink3">{why}</p>}
      </div>

      <div className="mt-1 flex flex-col gap-2.5">
        <Link
          href={focus.href}
          onClick={() => impact()}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--r-pill)] bg-ink py-3 text-[var(--t-body)] font-medium text-bg"
        >
          {focus.actionLabel}
          <Icon name="chevron-right" size={17} strokeWidth={2} />
        </Link>
        <Link
          href="/ask"
          className="inline-flex items-center justify-center gap-1.5 text-[var(--t-secondary)] font-medium text-ink3"
        >
          <Icon name="sparkle" size={14} strokeWidth={1.6} />
          Ask Bridge about this
        </Link>
      </div>
    </Card>
  );
}
