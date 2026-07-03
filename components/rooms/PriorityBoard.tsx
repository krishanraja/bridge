"use client";

/* The compass. Lands on a compact index of every priority; a tap opens the card;
   a card tap opens the two-page detail. The operator curates; principals react. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PriorityView } from "@/lib/data/views";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { PRIORITY_STATE, MOVE_STATE } from "@/lib/copy/states";
import { Dial } from "@/components/dial/Dial";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { createPriority, setMove, updateMove, updatePriority } from "@/app/actions";

export function PriorityBoard({
  priorities,
  seat,
}: {
  priorities: PriorityView[];
  seat: SeatId;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PriorityView | null>(null);
  const [detailPage, setDetailPage] = useState<0 | 1>(0);
  const [adding, setAdding] = useState(false);
  const operator = seat === 4;

  const open = priorities.find((p) => p.id === openId) ?? null;

  if (priorities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[14px] leading-relaxed text-ink2">
          No priorities yet. The table sets three to five, each with one
          sponsor and one move a week.
        </p>
        {operator && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-bg"
          >
            Seed the first one
          </button>
        )}
        <PriorityEditor
          open={adding}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 px-5 pb-3">
      {open === null ? (
        <div className="flex h-full flex-col gap-2">
          {priorities.map((p) => {
            const st = PRIORITY_STATE[p.state];
            return (
              <button
                key={p.id}
                onClick={() => {
                  tick();
                  setOpenId(p.id);
                }}
                className="flex min-h-0 flex-1 items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2 text-left"
                style={{ borderLeft: `3px solid ${st.color}` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium leading-snug text-ink">
                    {p.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="eyebrow" style={{ color: st.color }}>
                      {st.label}
                    </span>
                    <span className="eyebrow">
                      {SEATS[p.sponsor_seat].initials}
                    </span>
                    {p.move && (
                      <span
                        className="eyebrow"
                        style={{ color: MOVE_STATE[p.move.state].color }}
                      >
                        {MOVE_STATE[p.move.state].label}
                      </span>
                    )}
                  </div>
                </div>
                {p.confidence != null && (
                  <Dial value={p.confidence} size="micro" />
                )}
              </button>
            );
          })}
          {operator && priorities.length < 5 && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-xl border border-dashed border-line py-1.5 text-[11px] text-ink3"
            >
              Add a priority ({priorities.length} of 5)
            </button>
          )}
        </div>
      ) : (
        <PriorityCard
          priority={open}
          seat={seat}
          onBack={() => setOpenId(null)}
          onChanged={() => router.refresh()}
          onDetail={() => {
            setDetail(open);
            setDetailPage(0);
          }}
        />
      )}

      <PriorityEditor
        open={adding}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          router.refresh();
        }}
      />

      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name}
      >
        {detail && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDetailPage(0)}
                className="rounded-full border py-1.5 text-[12px] font-medium"
                style={{
                  borderColor: detailPage === 0 ? "var(--ink)" : "var(--line)",
                  color: detailPage === 0 ? "var(--ink)" : "var(--ink-3)",
                }}
              >
                Move history
              </button>
              <button
                onClick={() => setDetailPage(1)}
                className="rounded-full border py-1.5 text-[12px] font-medium"
                style={{
                  borderColor: detailPage === 1 ? "var(--ink)" : "var(--line)",
                  color: detailPage === 1 ? "var(--ink)" : "var(--ink-3)",
                }}
              >
                Linked items
              </button>
            </div>

            {detailPage === 0 ? (
              <div className="flex flex-col gap-2">
                {detail.history.length === 0 && (
                  <p className="text-[12px] text-ink3">
                    No moves yet. The first one is proposed on Monday.
                  </p>
                )}
                {detail.history.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-line px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="eyebrow">{m.iso_week}</span>
                      <span
                        className="eyebrow"
                        style={{ color: MOVE_STATE[m.state].color }}
                      >
                        {MOVE_STATE[m.state].label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-ink">
                      {m.text}
                    </p>
                    {m.outcome_note && (
                      <p className="mt-0.5 text-[10.5px] text-ink3">
                        {m.outcome_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="eyebrow">Threads</div>
                {detail.threads.length === 0 ? (
                  <p className="text-[12px] leading-relaxed text-ink3">
                    No relationships linked yet. The operator ties a thread to
                    this priority from Settings.
                  </p>
                ) : (
                  detail.threads.map((t) => (
                    <div key={t.id} className="rounded-lg border border-line px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-ink">
                          {t.name}
                        </span>
                        <span
                          className="eyebrow"
                          style={{
                            color:
                              t.status === "advancing"
                                ? "var(--mint-deep)"
                                : t.status === "stalled"
                                  ? "var(--risk)"
                                  : "var(--ink-3)",
                          }}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-ink3">
                        {t.org}
                        {t.nextTouchDate ? ` · next touch ${t.nextTouchDate}` : ""}
                      </p>
                      {t.nextTouchNote && (
                        <p className="mt-0.5 text-[11px] leading-snug text-ink2">
                          {t.nextTouchNote}
                        </p>
                      )}
                    </div>
                  ))
                )}
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink3">
                  Linked signals and decisions join these as the pipeline and
                  the log connect them.
                </p>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function PriorityCard({
  priority: p,
  seat,
  onBack,
  onDetail,
  onChanged,
}: {
  priority: PriorityView;
  seat: SeatId;
  onBack: () => void;
  onDetail: () => void;
  onChanged: () => void;
}) {
  const st = PRIORITY_STATE[p.state];
  const operator = seat === 4;
  const [editing, setEditing] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [missOpen, setMissOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canAgree = p.move?.state === "proposed";
  const canShip =
    p.move &&
    (p.move.owner_seat === seat || operator) &&
    (p.move.state === "agreed" || p.move.state === "proposed");

  return (
    <article
      className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-3 rounded-xl border border-line bg-paper p-4"
      style={{ borderLeft: `3px solid ${st.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onBack} className="eyebrow underline underline-offset-2">
          ← All priorities
        </button>
        <div className="flex items-center gap-1.5">
          {operator && (
            <Chip onClick={() => setEditing(true)}>Edit</Chip>
          )}
          <Chip color={st.color}>{st.label}</Chip>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="num-display min-w-0 text-[22px] font-medium leading-tight text-ink">
          {p.name}
        </h2>
        {p.confidence != null && (
          <Dial
            value={p.confidence}
            size="standard"
            label="Confidence"
            delta={p.confidenceDelta}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden">
        <div>
          <div className="eyebrow mb-0.5">This week&apos;s move</div>
          {p.move ? (
            <div>
              <p className="text-[13px] leading-snug text-ink">{p.move.text}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="eyebrow">{SEATS[p.move.owner_seat].initials}</span>
                <span
                  className="eyebrow"
                  style={{ color: MOVE_STATE[p.move.state].color }}
                >
                  {MOVE_STATE[p.move.state].label}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {canAgree && (
                  <Chip
                    active
                    onClick={() =>
                      startTransition(async () => {
                        confirmHaptic();
                        await updateMove({ id: p.move!.id, state: "agreed" });
                        onChanged();
                      })
                    }
                  >
                    Agree
                  </Chip>
                )}
                {(canAgree || operator) && (
                  <Chip onClick={() => setMoveOpen(true)}>Rewrite</Chip>
                )}
                {canShip && (
                  <>
                    <Chip
                      color="var(--mint-deep)"
                      onClick={() =>
                        startTransition(async () => {
                          confirmHaptic();
                          await updateMove({ id: p.move!.id, state: "shipped" });
                          onChanged();
                        })
                      }
                    >
                      Mark shipped
                    </Chip>
                    <Chip color="var(--risk)" onClick={() => setMissOpen(true)}>
                      Missed
                    </Chip>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-ink3">
                No move set. Monday&apos;s brief proposes one.
              </p>
              {operator && (
                <div className="mt-1.5">
                  <Chip active onClick={() => setMoveOpen(true)}>
                    Set this week&apos;s move
                  </Chip>
                </div>
              )}
            </div>
          )}
        </div>

        {p.blocker && (
          <div className="rounded-lg border border-line bg-risk-wash px-3 py-2">
            <div className="eyebrow mb-0.5" style={{ color: "var(--risk)" }}>
              Blocker · {p.blockerOwner ? SEATS[p.blockerOwner].shortName : ""}
            </div>
            <p className="text-[12px] leading-snug text-ink">{p.blocker}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="eyebrow">Sponsor</span>
          <span className="text-[12px] font-medium text-ink2">
            {SEATS[p.sponsor_seat].name}
          </span>
        </div>
      </div>

      <button
        onClick={onDetail}
        disabled={pending}
        className="rounded-full border border-line py-2 text-[12px] font-medium text-ink2"
      >
        History and links
      </button>

      <PriorityEditor
        open={editing}
        onClose={() => setEditing(false)}
        priority={p}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
      />
      <MoveEditor
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        priority={p}
        seat={seat}
        onDone={() => {
          setMoveOpen(false);
          onChanged();
        }}
      />
      <MissSheet
        open={missOpen}
        onClose={() => setMissOpen(false)}
        moveId={p.move?.id}
        onDone={() => {
          setMissOpen(false);
          onChanged();
        }}
      />
    </article>
  );
}

function PriorityEditor({
  open,
  onClose,
  onDone,
  priority,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  priority?: PriorityView;
}) {
  const [name, setName] = useState(priority?.name ?? "");
  const [sponsor, setSponsor] = useState<SeatId>(priority?.sponsor_seat ?? 1);
  const [state, setState] = useState(priority?.state ?? "driving");
  const [blocker, setBlocker] = useState(priority?.blocker ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = priority
        ? await updatePriority({
            id: priority.id,
            name,
            state,
            sponsor_seat: sponsor,
            blocker: blocker || null,
          })
        : await createPriority({ name, sponsor_seat: sponsor });
      if (res.ok) {
        confirmHaptic();
        onDone();
      } else {
        setNote(res.message ?? "That did not save.");
      }
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={priority ? "Edit priority" : "New priority"}
    >
      <div className="flex flex-col gap-3 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="The priority, sixty characters or fewer."
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
        />
        <div>
          <div className="eyebrow mb-1">Sponsor</div>
          <div className="flex gap-1.5">
            {SEAT_IDS.map((id) => (
              <Chip key={id} active={sponsor === id} onClick={() => setSponsor(id)}>
                {SEATS[id].shortName}
              </Chip>
            ))}
          </div>
        </div>
        {priority && (
          <>
            <div>
              <div className="eyebrow mb-1">State</div>
              <div className="flex flex-wrap gap-1.5">
                {(["driving", "at_risk", "blocked", "won", "retired"] as const).map(
                  (s) => (
                    <Chip key={s} active={state === s} onClick={() => setState(s)}>
                      {PRIORITY_STATE[s].label}
                    </Chip>
                  ),
                )}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Blocker, if any</div>
              <input
                value={blocker}
                onChange={(e) => setBlocker(e.target.value)}
                placeholder="One sentence, or leave empty."
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
              />
            </div>
          </>
        )}
        {note && <p className="text-[12px] text-risk">{note}</p>}
        <button
          disabled={pending || !name.trim()}
          onClick={save}
          className="rounded-full bg-ink py-2.5 text-[13px] font-medium text-bg disabled:opacity-60"
        >
          {pending ? "Saving" : priority ? "Save" : "Add it"}
        </button>
      </div>
    </Sheet>
  );
}

function MoveEditor({
  open,
  onClose,
  priority,
  seat,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  priority: PriorityView;
  seat: SeatId;
  onDone: () => void;
}) {
  const [text, setText] = useState(priority.move?.text ?? "");
  const [owner, setOwner] = useState<SeatId>(
    priority.move?.owner_seat ?? priority.sponsor_seat,
  );
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const operator = seat === 4;

  const save = () =>
    startTransition(async () => {
      const res = priority.move
        ? await updateMove({ id: priority.move.id, text })
        : await setMove({ priority_id: priority.id, text, owner_seat: owner });
      if (res.ok) {
        confirmHaptic();
        onDone();
      } else {
        setNote(res.message ?? "That did not save.");
      }
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={priority.move ? "Rewrite the move" : "This week's move"}
    >
      <div className="flex flex-col gap-3 pt-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="One sentence with a verb and an owner."
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
        />
        {!priority.move && operator && (
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
        )}
        {note && <p className="text-[12px] text-risk">{note}</p>}
        <button
          disabled={pending || !text.trim()}
          onClick={save}
          className="rounded-full bg-ink py-2.5 text-[13px] font-medium text-bg disabled:opacity-60"
        >
          {pending ? "Saving" : "Set it"}
        </button>
      </div>
    </Sheet>
  );
}

function MissSheet({
  open,
  onClose,
  moveId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  moveId?: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet open={open} onClose={onClose} title="Missed">
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-[11px] text-ink3">
          Missed is a first class state. It needs a one line reason.
        </p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why it slipped."
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
        />
        {note && <p className="text-[12px] text-risk">{note}</p>}
        <button
          disabled={pending || !reason.trim() || !moveId}
          onClick={() =>
            startTransition(async () => {
              const res = await updateMove({
                id: moveId!,
                state: "missed",
                outcome_note: reason,
              });
              if (res.ok) {
                tick();
                onDone();
              } else {
                setNote(res.message ?? "That did not save.");
              }
            })
          }
          className="rounded-full bg-ink py-2.5 text-[13px] font-medium text-bg disabled:opacity-60"
        >
          Mark it missed
        </button>
      </div>
    </Sheet>
  );
}
