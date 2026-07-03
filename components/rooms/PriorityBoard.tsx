"use client";

/* The compass. Lands on a compact index of every priority; a tap opens the card;
   a card tap opens the two-page detail. Depth by tap, never by scroll. */

import { useState } from "react";
import type { PriorityView } from "@/lib/data/views";
import { SEATS } from "@/lib/seats";
import { PRIORITY_STATE, MOVE_STATE } from "@/lib/copy/states";
import { Dial } from "@/components/dial/Dial";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { tick } from "@/lib/haptics";

export function PriorityBoard({ priorities }: { priorities: PriorityView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PriorityView | null>(null);
  const [detailPage, setDetailPage] = useState<0 | 1>(0);

  if (priorities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-[14px] leading-relaxed text-ink2">
          No priorities yet. The table sets three to five, each with one
          sponsor. The operator seeds them from Settings.
        </p>
      </div>
    );
  }

  const open = priorities.find((p) => p.id === openId) ?? null;

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
        </div>
      ) : (
        <PriorityCard
          priority={open}
          onBack={() => setOpenId(null)}
          onDetail={() => {
            setDetail(open);
            setDetailPage(0);
          }}
        />
      )}

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
              <p className="text-[12px] leading-relaxed text-ink3">
                Signals, decisions, and threads that touch this priority land
                here as the pipeline and the log link them.
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function PriorityCard({
  priority: p,
  onBack,
  onDetail,
}: {
  priority: PriorityView;
  onBack: () => void;
  onDetail: () => void;
}) {
  const st = PRIORITY_STATE[p.state];
  return (
    <article
      className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-3 rounded-xl border border-line bg-paper p-4"
      style={{ borderLeft: `3px solid ${st.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onBack} className="eyebrow underline underline-offset-2">
          ← All priorities
        </button>
        <Chip color={st.color}>{st.label}</Chip>
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
            </div>
          ) : (
            <p className="text-[13px] text-ink3">
              No move set. Monday&apos;s brief proposes one.
            </p>
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
        className="rounded-full border border-line py-2 text-[12px] font-medium text-ink2"
      >
        History and links
      </button>
    </article>
  );
}
