"use client";

/* The multiplayer room: alignment, decisions, receipts. Three zones, one screen.
   Monday's pulse and typed decision logging live here. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TableData } from "@/lib/data/views";
import type { Decision } from "@/lib/types";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { votePulse, logDecision, updateDecision } from "@/app/actions";

const DECISION_STATE: Record<Decision["state"], { label: string; color: string }> = {
  open: { label: "Open", color: "var(--ink-3)" },
  done: { label: "Done", color: "var(--mint-deep)" },
  dropped: { label: "Dropped", color: "var(--risk)" },
};

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

  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(log.length / pageSize));
  const votes = data.plot.find((p) => p.priorityId === votesFor);
  const hasVoted = data.votedThisWeek.includes(seat);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-2 pb-3">
      <header className="flex items-center justify-between px-5 pt-4">
        <div className="eyebrow">The table</div>
        <span className="eyebrow">{data.isoWeek}</span>
      </header>

      <section className="mx-5 flex flex-col gap-1.5 rounded-xl border border-line bg-paper p-3.5">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Alignment</div>
          {!hasVoted && data.plot.length > 0 && (
            <Chip active onClick={() => { tick(); setPulseOpen(true); }}>
              Cast this week&apos;s pulse
            </Chip>
          )}
        </div>
        <AlignmentPlot data={data} onDot={(id) => { tick(); setVotesFor(id); }} />
        <p className="text-[13px] leading-snug text-ink2">
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
      </section>

      <section className="mx-5 min-h-0 overflow-hidden rounded-xl border border-line bg-paper p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="eyebrow">Decisions</span>
          <div className="flex items-center gap-2.5">
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
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {data.decisions.length === 0 && (
            <p className="text-[14px] text-ink3">
              Nothing logged yet. You can say one in Ask, or add it here.
            </p>
          )}
          {data.decisions.map((d) => (
            <DecisionRow key={d.id} d={d} />
          ))}
        </div>
      </section>

      <section className="mx-5 flex items-center justify-between rounded-xl border border-line bg-paper px-3.5 py-2">
        <span className="eyebrow">Receipts</span>
        <div className="flex items-center gap-3">
          {data.receipts.map((r) => (
            <div key={r.seat} className="flex flex-col items-center gap-0.5">
              <span className="text-[12px] font-medium text-ink2">
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
      </section>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Decision log">
        <div className="flex flex-col gap-2.5 pt-1">
          {log
            .slice(logPage * pageSize, (logPage + 1) * pageSize)
            .map((d) => (
              <DecisionRow
                key={d.id}
                d={d}
                full
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
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <span className="text-[14px] font-medium text-ink">
                {SEATS[v.seat].name}
              </span>
              <span className="num-display text-[20px] font-medium">
                {v.confidence}
              </span>
            </div>
          ))}
          {votes && votes.votes.length === 0 && (
            <p className="text-[14px] text-ink3">No votes this week yet.</p>
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

function DecisionRow({
  d,
  full,
  canClose,
  onClosed,
}: {
  d: Decision;
  full?: boolean;
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
        <p
          className={`text-[14px] leading-snug text-ink ${full ? "" : "truncate"}`}
        >
          {d.text}
        </p>
        <p className="text-[12px] text-ink3">
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
        <p className="text-[13px] leading-snug text-ink3">
          How confident you feel about each priority, zero to a hundred. A minute a week, and the table can see where it lines up and where it does not.
        </p>
        {data.plot.map((p) => (
          <div key={p.priorityId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="min-w-0 truncate pr-3 text-[14px] font-medium text-ink">
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
        {note && <p className="text-[14px] text-risk">{note}</p>}
        <button
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
          className="rounded-full bg-ink py-2.5 text-[15px] font-medium text-bg disabled:opacity-60"
        >
          {pending ? "Saving" : "Save my read"}
        </button>
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
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
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
            className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
          />
        </div>
        {note && <p className="text-[14px] text-risk">{note}</p>}
        <button
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
          className="rounded-full bg-ink py-2.5 text-[15px] font-medium text-bg disabled:opacity-60"
        >
          {pending ? "Logging" : "Save it"}
        </button>
      </div>
    </Sheet>
  );
}

function AlignmentPlot({
  data,
  onDot,
}: {
  data: TableData;
  onDot: (id: string) => void;
}) {
  const W = 320;
  const H = 132;
  const pad = 24;
  const maxSpread = 60;

  /* Dots carry the priority's index; names live one tap away in the votes sheet. */
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect
        x={pad + (W - pad - 6) * 0.6}
        y={8}
        width={(W - pad - 6) * 0.4}
        height={(H - pad - 8) * 0.5}
        fill="var(--mint-wash)"
      />
      <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="var(--line)" />
      <line x1={pad} y1={8} x2={pad} y2={H - pad} stroke="var(--line)" />
      <text x={W - 6} y={H - 12} textAnchor="end" fill="var(--ink-3)" fontSize="8.5">
        confidence →
      </text>
      <text
        x={16}
        y={H - pad - 4}
        fill="var(--ink-3)"
        fontSize="8.5"
        transform={`rotate(-90 16 ${H - pad - 4})`}
      >
        spread →
      </text>
      {data.plot.map((p, i) => {
        const x = pad + (p.mean / 100) * (W - pad - 6);
        const y =
          H - pad - (Math.min(p.spread, maxSpread) / maxSpread) * (H - pad - 14);
        const tight = p.spread <= 15 && p.mean >= 60;
        return (
          <g
            key={p.priorityId}
            onClick={() => onDot(p.priorityId)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={y}
              r={8.5}
              fill={tight ? "var(--mint)" : "var(--paper)"}
              stroke={tight ? "var(--mint-deep)" : "var(--ink-2)"}
              strokeWidth={1.4}
            />
            <text
              x={x}
              y={y + 3}
              textAnchor="middle"
              fontSize="9"
              fontWeight={600}
              fill="var(--ink)"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
