"use client";

/* The operator's review card. Visible only to Seat 4 while a morning draft is
   unreleased. Edit the words, then release, or let 07:25 release it. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperatorReview } from "@/lib/data/views";
import { Sheet } from "@/components/ui/Sheet";
import { confirm as confirmHaptic } from "@/lib/haptics";

export function ReviewCard({ review }: { review: OperatorReview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(review.script);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const release = () =>
    startTransition(async () => {
      if (draft.trim() !== review.script.trim()) {
        const edit = await fetch("/api/brief/edit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ day: review.day, kind: review.kind, script: draft }),
        });
        if (!edit.ok) {
          setNote("The edit did not save.");
          return;
        }
      }
      const res = await fetch(`/api/brief/release?kind=${review.kind}`, { method: "POST" });
      if (res.ok) {
        confirmHaptic();
        setOpen(false);
        router.refresh();
      } else {
        setNote("Release failed.");
      }
    });

  return (
    <section className="mx-5 rounded-xl border border-mint-bd bg-mint-wash px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Draft brief, yours to shape</div>
          <p className="mt-0.5 text-[12px] text-ink2">
            Releases at {review.releaseAt} if you do nothing.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-medium text-bg"
        >
          Review
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Review the brief">
        <div className="flex flex-col gap-3 pt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none focus:border-ink"
          />
          {note && <p className="text-[12px] text-risk">{note}</p>}
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={release}
              className="flex-1 rounded-full bg-ink py-2.5 text-[13px] font-medium text-bg disabled:opacity-60"
            >
              {pending ? "Releasing" : "Release brief"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-line px-4 py-2.5 text-[12px] text-ink2"
            >
              Later
            </button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
