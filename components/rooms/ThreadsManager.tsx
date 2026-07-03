"use client";

/* The operator's relationships desk. Open threads, set the next touch, link them
   to a priority. Principals read them and move the status; the operator holds
   the pen on the rest. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { confirm as confirmHaptic } from "@/lib/haptics";
import { createThread, updateThread } from "@/app/actions";

export interface ThreadRow {
  id: string;
  name: string;
  org: string;
  seatOwner: SeatId;
  status: string;
  nextTouchDate: string | null;
  linkedPriorityName: string | null;
}

export function ThreadsManager({
  threads,
  priorities,
  isOperator,
}: {
  threads: ThreadRow[];
  priorities: { id: string; name: string }[];
  isOperator: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [owner, setOwner] = useState<SeatId>(1);
  const [touch, setTouch] = useState("");
  const [note, setNote] = useState("");
  const [linked, setLinked] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const statusColor = (s: string) =>
    s === "advancing"
      ? "var(--mint-deep)"
      : s === "stalled"
        ? "var(--risk)"
        : "var(--ink-3)";

  return (
    <section className="mx-5 flex items-center justify-between rounded-xl border border-line bg-paper px-3.5 py-2.5">
      <div>
        <div className="eyebrow">Threads</div>
        <p className="text-[13px] text-ink3">
          {threads.length} relationship{threads.length === 1 ? "" : "s"} in play
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-line px-3.5 py-1.5 text-[14px] font-medium text-ink2"
      >
        Open
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Threads">
        <div className="flex flex-col gap-2.5 pt-1">
          {isOperator && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="self-start rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-medium text-bg"
            >
              Open a thread
            </button>
          )}

          {adding && (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who or what"
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
              />
              <input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Org"
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
              />
              <div className="flex gap-1.5">
                {SEAT_IDS.map((id) => (
                  <Chip key={id} active={owner === id} onClick={() => setOwner(id)}>
                    {SEATS[id].shortName}
                  </Chip>
                ))}
              </div>
              <input
                type="date"
                value={touch}
                onChange={(e) => setTouch(e.target.value)}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Next touch, one line"
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
              />
              <select
                value={linked}
                onChange={(e) => setLinked(e.target.value)}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
              >
                <option value="">No linked priority</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {err && <p className="text-[14px] text-risk">{err}</p>}
              <div className="flex gap-2">
                <button
                  disabled={pending || !name.trim() || !org.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await createThread({
                        name,
                        org,
                        seat_owner: owner,
                        next_touch_date: touch || null,
                        next_touch_note: note || null,
                        linked_priority_id: linked || null,
                      });
                      if (res.ok) {
                        confirmHaptic();
                        setAdding(false);
                        setName("");
                        setOrg("");
                        setTouch("");
                        setNote("");
                        setLinked("");
                        router.refresh();
                      } else {
                        setErr(res.message ?? "That did not save.");
                      }
                    })
                  }
                  className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg disabled:opacity-60"
                >
                  Open it
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="rounded-full border border-line px-4 py-2 text-[14px] text-ink2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {threads.length === 0 && !adding && (
            <p className="text-[14px] text-ink3">
              No threads yet. The relationships worth staying close to live here.
            </p>
          )}

          {threads.map((t) => (
            <div key={t.id} className="rounded-lg border border-line px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-ink">{t.name}</span>
                <span className="eyebrow" style={{ color: statusColor(t.status) }}>
                  {t.status}
                </span>
              </div>
              <p className="text-[12px] text-ink3">
                {t.org} · {SEATS[t.seatOwner].shortName}
                {t.nextTouchDate ? ` · next ${t.nextTouchDate}` : ""}
                {t.linkedPriorityName ? ` · ${t.linkedPriorityName}` : ""}
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {(["advancing", "stalled", "dormant"] as const).map((s) => (
                  <Chip
                    key={s}
                    active={t.status === s}
                    onClick={() =>
                      startTransition(async () => {
                        await updateThread({ id: t.id, status: s });
                        router.refresh();
                      })
                    }
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
