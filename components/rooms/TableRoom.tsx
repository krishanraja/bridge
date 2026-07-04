"use client";

/* The multiplayer room: alignment, decisions, receipts. One scroll-safe canvas.
   Monday's pulse and typed decision logging live here, and every decision now
   carries its own read receipts and sign-off. */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TableData, DecisionReceipt } from "@/lib/data/views";
import type { Decision } from "@/lib/types";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Avatar, type AvatarState } from "@/components/ui/Avatar";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import {
  votePulse,
  logDecision,
  updateDecision,
  markDecisionSeen,
  concurDecision,
  leaveDecisionFeedback,
} from "@/app/actions";

const DECISION_STATE: Record<Decision["state"], { label: string; color: string }> = {
  open: { label: "Open", color: "var(--ink-3)" },
  done: { label: "Done", color: "var(--mint-deep)" },
  dropped: { label: "Dropped", color: "var(--risk)" },
};

const EMPTY_RECEIPT: DecisionReceipt = { seen: [], concurred: [], feedback: [] };

function seatState(rec: DecisionReceipt, seat: SeatId): AvatarState {
  if (rec.concurred.includes(seat)) return "concurred";
  if (rec.feedback.some((f) => f.seat === seat)) return "feedback";
  if (rec.seen.includes(seat)) return "seen";
  return "unseen";
}

function receiptSummary(rec: DecisionReceipt): string {
  const parts: string[] = [];
  if (rec.concurred.length) parts.push(`${rec.concurred.length} concurred`);
  if (rec.feedback.length) parts.push(`${rec.feedback.length} with feedback`);
  if (!parts.length) {
    parts.push(rec.seen.length ? `seen by ${rec.seen.length}` : "not seen yet");
  }
  return parts.join(" · ");
}

export function TableRoom({
  data,
  log,
  seat,
}: {
  data: TableData;
  log: Decision[];
  seat: SeatId;
}) {
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const [votesFor, setVotesFor] = useState<string | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [openDecision, setOpenDecision] = useState<Decision | null>(null);

  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(log.length / pageSize));
  const votes = data.plot.find((p) => p.priorityId === votesFor);
  const hasVoted = data.votedThisWeek.includes(seat);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between px-[var(--pad-x)] pt-4 pb-1">
        <div className="eyebrow">The table</div>
        <span className="eyebrow">{data.isoWeek}</span>
      </header>

      <div className="room-canvas">
        <Card className="flex flex-col gap-3">
          <SectionLabel
            right={
              !hasVoted && data.plot.length > 0 ? (
                <Chip active onClick={() => { tick(); setPulseOpen(true); }}>
                  Cast this week&apos;s pulse
                </Chip>
              ) : undefined
            }
          >
            Alignment
          </SectionLabel>
          <AlignmentPlot data={data} onDot={(id) => { tick(); setVotesFor(id); }} />
          <p className="t-secondary text-ink2">
            {data.widestSplit ? (
              <>
                Widest split this week: {data.widestSplit.priorityName},{" "}
                {SEATS[data.widestSplit.lowSeat].shortName} at{" "}
                {data.widestSplit.lowVal}, {SEATS[data.widestSplit.highSeat].shortName}{" "}
                at {data.widestSplit.highVal}. Worth ten minutes on Monday.
              </>
            ) : (
              "No reads in yet this week. Adding yours takes about a minute."
            )}
          </p>
        </Card>

        <Card className="flex flex-col gap-1">
          <SectionLabel
            right={
              <>
                <button
                  onClick={() => setDecisionOpen(true)}
                  className="eyebrow underline underline-offset-2"
                >
                  Add one
                </button>
                <button
                  onClick={() => setLogOpen(true)}
                  className="eyebrow underline underline-offset-2"
                >
                  The log
                </button>
              </>
            }
          >
            Decisions
          </SectionLabel>
          {data.decisions.length === 0 ? (
            <p className="t-secondary py-2 text-ink3">
              Nothing logged yet. You can say one in Ask, or add it here.
            </p>
          ) : (
            <div className="mt-1 flex flex-col divide-y divide-line">
              {data.decisions.map((d) => (
                <DecisionRow
                  key={d.id}
                  d={d}
                  receipt={data.decisionReceipts[d.id] ?? EMPTY_RECEIPT}
                  onOpen={() => { tick(); setOpenDecision(d); }}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Weekly cadence, demoted: who has read this week's brief and cast the
           pulse. The substantive receipts now live on each decision above. */}
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="eyebrow">Caught up this week</span>
          <div className="flex items-center gap-3">
            {data.receipts.map((r) => (
              <div key={r.seat} className="flex items-center gap-1.5">
                <span className="t-label font-medium text-ink3">
                  {SEATS[r.seat].initials}
                </span>
                <div className="flex gap-1">
                  <span
                    title="brief"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: r.brief ? "var(--mint)" : "transparent",
                      border: r.brief
                        ? "1px solid var(--mint-deep)"
                        : "1px solid var(--ink-3)",
                    }}
                  />
                  <span
                    title="pulse"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: r.pulse ? "var(--mint)" : "transparent",
                      border: r.pulse
                        ? "1px solid var(--mint-deep)"
                        : "1px solid var(--ink-3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DecisionDetailSheet
        decision={openDecision}
        receipt={openDecision ? data.decisionReceipts[openDecision.id] ?? EMPTY_RECEIPT : EMPTY_RECEIPT}
        seat={seat}
        onClose={() => setOpenDecision(null)}
        onChanged={() => router.refresh()}
      />

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Decision log">
        <div className="flex flex-col gap-2.5 pt-1">
          {log
            .slice(logPage * pageSize, (logPage + 1) * pageSize)
            .map((d) => (
              <LogRow
                key={d.id}
                d={d}
                canClose={d.state === "open" && (seat === d.owner_seat || seat === 4)}
                onClosed={() => router.refresh()}
              />
            ))}
          {pages > 1 && (
            <div className="mt-1 flex items-center justify-between">
              <button
                disabled={logPage === 0}
                onClick={() => setLogPage((p) => p - 1)}
                className="eyebrow disabled:opacity-40"
              >
                ← Newer
              </button>
              <span className="eyebrow">
                {logPage + 1} of {pages}
              </span>
              <button
                disabled={logPage >= pages - 1}
                onClick={() => setLogPage((p) => p + 1)}
                className="eyebrow disabled:opacity-40"
              >
                Older →
              </button>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={votes != null}
        onClose={() => setVotesFor(null)}
        title={votes?.name}
      >
        <div className="flex flex-col gap-2 pt-1">
          {votes?.votes.map((v) => (
            <div
              key={v.seat}
              className="flex items-center justify-between rounded-[var(--r-md)] border border-line px-3 py-2"
            >
              <span className="t-secondary font-medium text-ink">
                {SEATS[v.seat].name}
              </span>
              <span className="num-display text-[20px] font-medium">
                {v.confidence}
              </span>
            </div>
          ))}
          {votes && votes.votes.length === 0 && (
            <p className="t-secondary text-ink3">No votes this week yet.</p>
          )}
        </div>
      </Sheet>

      <PulseSheet
        open={pulseOpen}
        onClose={() => setPulseOpen(false)}
        data={data}
        seat={seat}
        onDone={() => {
          setPulseOpen(false);
          router.refresh();
        }}
      />

      <DecisionSheet
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        onDone={() => {
          setDecisionOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

/* A decision as it sits in the list: state dot, one line, meta, and the seat
   cluster showing who has seen it and who has taken a position. Tap to open. */
function DecisionRow({
  d,
  receipt,
  onOpen,
}: {
  d: Decision;
  receipt: DecisionReceipt;
  onOpen: () => void;
}) {
  const st = DECISION_STATE[d.state];
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-2 py-3 text-left first:pt-1 last:pb-1"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: st.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="t-secondary truncate text-ink">{d.text}</p>
          <p className="t-label mt-0.5 text-ink3">
            {SEATS[d.owner_seat].shortName} owns it
            {d.due_date ? ` · due ${d.due_date}` : ""} · logged by{" "}
            {SEATS[d.logged_by].shortName}
          </p>
        </div>
        <svg
          className="mt-1 shrink-0 text-ink3"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
      <div className="flex items-center gap-2 pl-[18px]">
        <div className="flex items-center gap-1">
          {SEAT_IDS.map((s) => (
            <Avatar key={s} seat={s} state={seatState(receipt, s)} size="sm" />
          ))}
        </div>
        <span className="eyebrow">{receiptSummary(receipt)}</span>
      </div>
    </button>
  );
}

/* The full decision, opened from the list. Records a read receipt on open,
   shows who is where, and lets this seat concur or leave feedback. */
function DecisionDetailSheet({
  decision: d,
  receipt,
  seat,
  onClose,
  onChanged,
}: {
  decision: Decision | null;
  receipt: DecisionReceipt;
  seat: SeatId;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [note, setNote] = useState("");
  const [warn, setWarn] = useState<string | null>(null);

  /* Opening a decision marks it seen for this seat. */
  useEffect(() => {
    if (d) void markDecisionSeen(d.id);
  }, [d]);

  useEffect(() => {
    if (!d) {
      setFeedbackOpen(false);
      setNote("");
      setWarn(null);
    }
  }, [d]);

  const myState = d ? seatState(receipt, seat) : "unseen";
  const st = d ? DECISION_STATE[d.state] : null;

  return (
    <Sheet open={d !== null} onClose={onClose} title="Decision">
      {d && (
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: st!.color }}
              />
              <span className="eyebrow" style={{ color: st!.color }}>
                {st!.label}
              </span>
            </div>
            <p className="t-lede text-ink">{d.text}</p>
            <p className="t-label text-ink3">
              {SEATS[d.owner_seat].shortName} owns it
              {d.due_date ? ` · due ${d.due_date}` : ""} · logged by{" "}
              {SEATS[d.logged_by].shortName} ({d.logged_via})
            </p>
          </div>

          <ReceiptGroup label="Seen it" seats={receipt.seen} state="seen" empty="No one yet" />
          <ReceiptGroup
            label="Concurred"
            seats={receipt.concurred}
            state="concurred"
            empty="No sign-off yet"
          />
          {receipt.feedback.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow" style={{ color: "var(--amber)" }}>
                Feedback
              </span>
              {receipt.feedback.map((f) => (
                <div
                  key={f.seat}
                  className="rounded-[var(--r-md)] border border-amber-bd bg-amber-wash px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Avatar seat={f.seat} state="feedback" size="sm" />
                    <span className="t-label font-medium text-ink2">
                      {SEATS[f.seat].shortName}
                    </span>
                  </div>
                  {f.note && (
                    <p className="t-secondary mt-1 text-ink">{f.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {feedbackOpen ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="What would you change, in a line or two."
                className="w-full rounded-[var(--r-md)] border border-line bg-paper px-3 py-2.5 text-[var(--t-body)] text-ink outline-none focus:border-ink"
              />
              {warn && <p className="t-secondary text-risk">{warn}</p>}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFeedbackOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  full
                  disabled={pending || !note.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await leaveDecisionFeedback(d.id, note);
                      if (res.ok) {
                        confirmHaptic();
                        setFeedbackOpen(false);
                        setNote("");
                        onChanged();
                      } else {
                        setWarn(res.message ?? "That did not save.");
                      }
                    })
                  }
                >
                  Send feedback
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                full
                disabled={pending || myState === "concurred"}
                onClick={() =>
                  startTransition(async () => {
                    const res = await concurDecision(d.id);
                    if (res.ok) {
                      confirmHaptic();
                      onChanged();
                    } else {
                      setWarn(res.message ?? "That did not go through.");
                    }
                  })
                }
              >
                {myState === "concurred" ? "You concurred" : "Concur"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                full
                onClick={() => { tick(); setFeedbackOpen(true); }}
              >
                Leave feedback
              </Button>
            </div>
          )}
          {warn && !feedbackOpen && (
            <p className="t-secondary text-risk">{warn}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ReceiptGroup({
  label,
  seats,
  state,
  empty,
}: {
  label: string;
  seats: SeatId[];
  state: AvatarState;
  empty: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="eyebrow">{label}</span>
      {seats.length ? (
        <div className="flex items-center gap-1">
          {seats.map((s) => (
            <Avatar key={s} seat={s} state={state} size="sm" />
          ))}
        </div>
      ) : (
        <span className="t-label text-ink3">{empty}</span>
      )}
    </div>
  );
}

/* The log's rows keep the old full-text shape plus the operator's close/drop. */
function LogRow({
  d,
  canClose,
  onClosed,
}: {
  d: Decision;
  canClose?: boolean;
  onClosed?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const st = DECISION_STATE[d.state];
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: st.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="t-secondary leading-snug text-ink">{d.text}</p>
        <p className="t-label text-ink3">
          {SEATS[d.owner_seat].shortName} owns it
          {d.due_date ? ` · due ${d.due_date}` : ""} · logged by{" "}
          {SEATS[d.logged_by].shortName} ({d.logged_via})
        </p>
        {canClose && (
          <div className="mt-1 flex gap-2">
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  confirmHaptic();
                  await updateDecision({ id: d.id, state: "done" });
                  onClosed?.();
                })
              }
              className="rounded-full border border-mint-bd bg-mint-wash px-2.5 py-0.5 text-[12px] font-medium text-ink"
            >
              Mark done
            </button>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  tick();
                  await updateDecision({ id: d.id, state: "dropped" });
                  onClosed?.();
                })
              }
              className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink3"
            >
              Drop it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PulseSheet({
  open,
  onClose,
  data,
  seat,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  data: TableData;
  seat: SeatId;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const current = (id: string) =>
    values[id] ??
    data.plot.find((p) => p.priorityId === id)?.votes.find((v) => v.seat === seat)
      ?.confidence ??
    60;

  return (
    <Sheet open={open} onClose={onClose} title="This week's pulse">
      <div className="flex flex-col gap-3 pt-1">
        <p className="t-secondary text-ink3">
          How confident you feel about each priority, zero to a hundred. A minute a week, and the table can see where it lines up and where it does not.
        </p>
        {data.plot.map((p) => (
          <div key={p.priorityId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="min-w-0 truncate pr-3 text-[var(--t-secondary)] font-medium text-ink">
                {p.name}
              </span>
              <span className="num-display text-[20px] font-medium">
                {current(p.priorityId)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={current(p.priorityId)}
              onChange={(e) => {
                setValues((v) => ({ ...v, [p.priorityId]: Number(e.target.value) }));
              }}
              onPointerUp={() => tick()}
              className="w-full accent-[var(--mint-deep)]"
            />
          </div>
        ))}
        {note && <p className="t-secondary text-risk">{note}</p>}
        <Button
          full
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await votePulse(
                data.plot.map((p) => ({
                  priority_id: p.priorityId,
                  confidence: current(p.priorityId),
                })),
              );
              if (res.ok) {
                confirmHaptic();
                onDone();
              } else {
                setNote(res.message ?? "The vote did not land.");
              }
            })
          }
        >
          {pending ? "Saving" : "Save my read"}
        </Button>
      </div>
    </Sheet>
  );
}

function DecisionSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<SeatId>(1);
  const [due, setDue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet open={open} onClose={onClose} title="Log a decision">
      <div className="flex flex-col gap-3 pt-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was decided, in one sentence."
          rows={3}
          className="w-full rounded-[var(--r-md)] border border-line bg-paper px-3 py-2.5 text-[var(--t-body)] text-ink outline-none focus:border-ink"
        />
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
        <div>
          <div className="eyebrow mb-1">Due</div>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-[var(--r-md)] border border-line bg-paper px-3 py-2 text-[var(--t-body)] text-ink outline-none focus:border-ink"
          />
        </div>
        {note && <p className="t-secondary text-risk">{note}</p>}
        <Button
          full
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await logDecision({
                text,
                owner_seat: owner,
                due_date: due || null,
                logged_via: "typed",
              });
              if (res.ok) {
                confirmHaptic();
                setText("");
                setDue("");
                onDone();
              } else {
                setNote(res.message ?? "That did not save.");
              }
            })
          }
        >
          {pending ? "Logging" : "Save it"}
        </Button>
      </div>
    </Sheet>
  );
}

/* Alignment: confidence across, spread up. A roomy plot with de-overlapped
   markers, so a tight cluster stays legible. Names live one tap away. */
function AlignmentPlot({
  data,
  onDot,
}: {
  data: TableData;
  onDot: (id: string) => void;
}) {
  const W = 340;
  const H = 208;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 30;
  const maxSpread = 60;
  const R = 12;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  /* Place, then relax overlaps deterministically so equal reads don't collide. */
  const pts = data.plot.map((p, i) => ({
    i,
    id: p.priorityId,
    x: padL + (p.mean / 100) * plotW,
    y: padT + plotH - (Math.min(p.spread, maxSpread) / maxSpread) * (plotH - R),
    tight: p.spread <= 15 && p.mean >= 60,
  }));
  const minGap = 2 * R + 2;
  for (let iter = 0; iter < 4; iter++) {
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        let dx = pts[b].x - pts[a].x;
        let dy = pts[b].y - pts[a].y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        if (dist < minGap) {
          const push = (minGap - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          pts[a].x -= ux * push;
          pts[a].y -= uy * push;
          pts[b].x += ux * push;
          pts[b].y += uy * push;
        }
      }
    }
  }
  /* Keep dots inside the plot after nudging. */
  for (const pt of pts) {
    pt.x = Math.max(padL + R, Math.min(W - padR - R, pt.x));
    pt.y = Math.max(padT + R, Math.min(padT + plotH - R, pt.y));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* The good zone: high confidence, low spread. */}
      <rect
        x={padL + plotW * 0.6}
        y={padT}
        width={plotW * 0.4}
        height={plotH * 0.42}
        rx={6}
        fill="var(--mint-wash)"
      />
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--line)" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="var(--line)" />
      <text
        x={W - padR}
        y={H - 10}
        textAnchor="end"
        fill="var(--ink-3)"
        fontSize="11"
      >
        confidence →
      </text>
      <text
        x={12}
        y={padT + plotH}
        fill="var(--ink-3)"
        fontSize="11"
        transform={`rotate(-90 12 ${padT + plotH})`}
      >
        spread ↑
      </text>
      {pts.map((pt) => (
        <g
          key={pt.id}
          onClick={() => onDot(pt.id)}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={pt.x}
            cy={pt.y}
            r={R}
            fill={pt.tight ? "var(--mint)" : "var(--paper)"}
            stroke={pt.tight ? "var(--mint-deep)" : "var(--ink-2)"}
            strokeWidth={1.6}
          />
          <text
            x={pt.x}
            y={pt.y + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight={600}
            fill="var(--ink)"
          >
            {pt.i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
