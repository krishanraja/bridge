"use client";

/* The operator's inbox. When a leader taps "Act on it" on the radar, the item
   lands here for the operator to turn into this week's move or a logged decision,
   or to clear. This is the real destination behind "Act" — the handoff a
   chief-of-staff makes. Operator only; principals never see it. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoutedSignal } from "@/lib/types";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { LANES } from "@/lib/copy/lanes";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { setMove, logDecision, resolveRoutedSignal } from "@/app/actions";

export function OperatorInbox({
  routed,
  priorities,
}: {
  routed: RoutedSignal[];
  priorities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<RoutedSignal | null>(null);

  if (routed.length === 0) return null;

  return (
    <section className="mx-5 rise rise-1">
      <button
        onClick={() => {
          tick();
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-[var(--r-md)] border border-mint-bd bg-mint-wash px-3.5 py-2.5 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--mint-deep)", color: "var(--paper)" }}
        >
          <Icon name="bolt" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block" style={{ color: "var(--mint-deep)" }}>
            Routed to you
          </span>
          <span className="t-label block text-ink2">
            {routed.length} signal{routed.length === 1 ? "" : "s"} to turn into a move
          </span>
        </span>
        <Icon name="chevron-right" size={16} strokeWidth={1.8} className="shrink-0 text-ink3" />
      </button>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setItem(null);
        }}
        title={item ? "Turn it into something" : "Routed to you"}
      >
        {item ? (
          <TriageItem
            item={item}
            priorities={priorities}
            onBack={() => setItem(null)}
            onDone={() => {
              setItem(null);
              router.refresh();
            }}
          />
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            <p className="t-secondary text-ink3">
              Leaders flagged these as worth acting on. Turn each into this week&apos;s
              move or a decision, or clear it.
            </p>
            {routed.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  tick();
                  setItem(r);
                }}
                className="flex items-start gap-2.5 rounded-[var(--r-md)] border border-line px-3 py-2.5 text-left"
              >
                {r.lane != null && (
                  <span
                    className="mt-0.5 shrink-0"
                    style={{ color: `var(${LANES[r.lane].cssVar})` }}
                  >
                    <Icon name={LANES[r.lane].icon} size={16} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="t-secondary block leading-snug text-ink">
                    {r.headline}
                  </span>
                  <span className="eyebrow mt-0.5 block">
                    From {SEATS[r.from_seat].shortName}
                  </span>
                </span>
                <Icon name="chevron-right" size={15} className="mt-1 shrink-0 text-ink3" />
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </section>
  );
}

function TriageItem({
  item,
  priorities,
  onBack,
  onDone,
}: {
  item: RoutedSignal;
  priorities: { id: string; name: string }[];
  onBack: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"pick" | "move">("pick");
  const [priorityId, setPriorityId] = useState<string>(priorities[0]?.id ?? "");
  const [text, setText] = useState(item.posture ?? item.headline);
  const [owner, setOwner] = useState<SeatId>(item.from_seat);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const finish = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setNote(res.message ?? "That did not save.");
        return;
      }
      await resolveRoutedSignal({ id: item.id, status: "converted" });
      confirmHaptic();
      onDone();
    });

  return (
    <div className="flex flex-col gap-3 pt-1">
      <button onClick={onBack} className="eyebrow self-start underline underline-offset-2">
        ← All routed
      </button>
      <p className="t-secondary leading-snug text-ink">{item.headline}</p>

      {mode === "pick" ? (
        <div className="flex flex-col gap-2">
          <Button full onClick={() => { tick(); setMode("move"); }}>
            Make it this week&apos;s move
          </Button>
          <Button
            variant="secondary"
            full
            disabled={pending}
            onClick={() =>
              finish(() =>
                logDecision({
                  text,
                  owner_seat: item.from_seat,
                  source_ref: { signal_id: item.signal_id },
                }),
              )
            }
          >
            Log it as a decision
          </Button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await resolveRoutedSignal({ id: item.id, status: "dismissed" });
                tick();
                onDone();
              })
            }
            className="t-secondary py-1.5 font-medium text-ink3"
          >
            Not worth carrying
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <div className="eyebrow mb-1">The move</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="w-full rounded-[var(--r-md)] border border-line bg-paper px-3 py-2.5 text-[var(--t-body)] text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <div className="eyebrow mb-1">On which priority</div>
            <div className="flex flex-wrap gap-1.5">
              {priorities.map((p) => (
                <Chip key={p.id} active={priorityId === p.id} onClick={() => setPriorityId(p.id)}>
                  {p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">Owner</div>
            <div className="flex gap-1.5">
              {SEAT_IDS.map((id) => (
                <Chip key={id} active={owner === id} onClick={() => setOwner(id)}>
                  {SEATS[id].shortName}
                </Chip>
              ))}
            </div>
          </div>
          {note && <p className="t-secondary text-risk">{note}</p>}
          <Button
            full
            disabled={pending || !text.trim() || !priorityId}
            onClick={() =>
              finish(() => setMove({ priority_id: priorityId, text, owner_seat: owner }))
            }
          >
            {pending ? "Saving" : "Set the move"}
          </Button>
        </div>
      )}
      {note && mode === "pick" && <p className="t-secondary text-risk">{note}</p>}
    </div>
  );
}
