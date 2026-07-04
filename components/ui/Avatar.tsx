/* A seat, as initials in a ring. The ring carries the state so a cluster of
   avatars reads at a glance:
     unseen    — hollow, muted. Hasn't looked yet.
     seen      — solid hairline. Viewed it, no position taken.
     concurred — mint. Signed off.
     feedback  — amber. Left a note. */

import { SEATS, type SeatId } from "@/lib/seats";

export type AvatarState = "unseen" | "seen" | "concurred" | "feedback";
type AvatarSize = "sm" | "md";

const RING: Record<AvatarState, { border: string; bg: string; text: string }> = {
  unseen: { border: "var(--line)", bg: "transparent", text: "var(--ink-3)" },
  seen: { border: "var(--ink-3)", bg: "var(--paper)", text: "var(--ink-2)" },
  concurred: { border: "var(--mint-deep)", bg: "var(--mint-wash)", text: "var(--mint-deep)" },
  feedback: { border: "var(--amber-bd)", bg: "var(--amber-wash)", text: "var(--amber)" },
};

const DIM: Record<AvatarSize, { px: number; font: number }> = {
  sm: { px: 22, font: 9.5 },
  md: { px: 30, font: 12 },
};

export function Avatar({
  seat,
  state = "unseen",
  size = "sm",
  title,
}: {
  seat: SeatId;
  state?: AvatarState;
  size?: AvatarSize;
  title?: string;
}) {
  const r = RING[state];
  const d = DIM[size];
  return (
    <span
      title={title ?? `${SEATS[seat].name} — ${state}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: d.px,
        height: d.px,
        fontSize: d.font,
        border: `1.5px solid ${r.border}`,
        background: r.bg,
        color: r.text,
        opacity: state === "unseen" ? 0.6 : 1,
      }}
    >
      {SEATS[seat].initials}
    </span>
  );
}
