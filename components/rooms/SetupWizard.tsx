"use client";

/* The setup wizard. One card, one tap, under a minute. Each tap saves the answer,
   fires a light haptic, holds a beat so the choice registers, then the next card
   slides in. Nothing is required: any card can be skipped, and a half finished
   run still saves what was answered and still reads cleanly in the summary. In
   the demo, card one is a live picker so any seat's filled setup can be shown. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeatPrefs } from "@/lib/types";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import {
  CORE_CARDS,
  DEEPER_CARDS,
  SEAT_CARD,
  cardFor,
  buildSummary,
  type PrefCard,
} from "@/lib/copy/prefs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { selection, impact, success } from "@/lib/haptics";
import { savePref, finishPrefs } from "@/app/actions";

type Answers = Record<string, string>;

function answersFrom(prefs: SeatPrefs | null): Answers {
  if (!prefs) return {};
  const out: Answers = {};
  for (const c of [...CORE_CARDS, ...DEEPER_CARDS]) {
    const v = (prefs as unknown as Record<string, unknown>)[c.field];
    if (typeof v === "string" && v) out[c.field] = v;
  }
  return out;
}

type Phase = "core" | "summary" | "offer" | "deeper" | "edit";

export function SetupWizard({
  seat,
  initialPrefs,
  allPrefs,
  demo,
  startField,
  returnTo,
}: {
  seat: SeatId;
  initialPrefs: SeatPrefs | null;
  allPrefs: SeatPrefs[];
  demo: boolean;
  startField?: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [activeSeat, setActiveSeat] = useState<SeatId>(seat);
  const [answers, setAnswers] = useState<Answers>(() => answersFrom(initialPrefs));
  const [phase, setPhase] = useState<Phase>(startField ? "edit" : "core");
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<string | null>(null);

  const editCard = startField ? cardFor(startField) : undefined;

  const save = (field: string, value: string) => {
    if (demo) return; // sample data holds locally; nothing writes
    void savePref({ field, value });
  };

  const goNext = () => {
    if (phase === "core") {
      if (index < CORE_CARDS.length - 1) setIndex(index + 1);
      else setPhase("summary");
    } else if (phase === "deeper") {
      if (index < DEEPER_CARDS.length - 1) setIndex(index + 1);
      else finishAndLeave();
    }
  };

  /* Tap, hold a beat, advance. */
  const choose = (field: string, value: string, isSeat = false) => {
    selection();
    setPending(value);
    if (isSeat) {
      const sid = Number(value) as SeatId;
      setActiveSeat(sid);
      if (demo) setAnswers(answersFrom(allPrefs.find((p) => p.seat === sid) ?? null));
    } else {
      setAnswers((a) => ({ ...a, [field]: value }));
      save(field, value);
    }
    window.setTimeout(async () => {
      setPending(null);
      if (phase === "edit") {
        if (!demo) await finishPrefs();
        router.push(returnTo);
      } else {
        goNext();
      }
    }, 260);
  };

  const skip = () => {
    selection();
    if (phase === "edit") router.push(returnTo);
    else goNext();
  };

  const finishAndLeave = async () => {
    if (!demo) await finishPrefs();
    router.push(returnTo);
  };

  const done = () => {
    impact();
    if (!demo) void finishPrefs();
    setPhase("offer");
  };

  /* Edit one card, opened from Settings. */
  if (phase === "edit" && editCard) {
    return (
      <Frame progress={1}>
        <QuestionCard
          card={editCard}
          answers={answers}
          pending={pending}
          activeSeat={activeSeat}
          canSwitchSeat={demo}
          onChoose={choose}
        />
        <SkipRow onSkip={skip} label="Leave it" />
      </Frame>
    );
  }

  if (phase === "summary") {
    const summary = buildSummary({ seat: activeSeat, ...(answers as Partial<SeatPrefs>) });
    return (
      <Frame progress={1}>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
          <div className="rise">
            <div className="eyebrow mb-1" style={{ color: "var(--mint-deep)" }}>
              <span className="mr-1 inline-flex align-middle">
                <Icon name="sparkle" size={14} />
              </span>
              How to work with {SEATS[activeSeat].shortName}
            </div>
            <Card className="rise" style={{ padding: "var(--space-5)" }}>
              <p className="t-lede leading-relaxed text-ink">{summary}</p>
            </Card>
            <p className="mt-2 t-label text-ink3">
              This is what your chief of staff and the app will read. You can change any of it later.
            </p>
          </div>
        </div>
        <div className="px-[var(--pad-x)] pb-7 pt-2">
          <Button full onClick={done}>
            Done
          </Button>
        </div>
      </Frame>
    );
  }

  if (phase === "offer") {
    return (
      <Frame progress={1}>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-6">
          <h2 className="t-title rise text-ink">
            That is everything we need. Want to go deeper?
          </h2>
          <div className="flex flex-col gap-2.5 rise">
            <Button
              full
              onClick={() => {
                selection();
                setIndex(0);
                setPhase("deeper");
              }}
            >
              Add more
            </Button>
            <Button variant="secondary" full onClick={finishAndLeave}>
              Not now
            </Button>
          </div>
        </div>
      </Frame>
    );
  }

  /* core or deeper: a single question card. */
  const list = phase === "deeper" ? DEEPER_CARDS : CORE_CARDS;
  const card = list[index];
  const total = list.length;
  const progress = (index + 1) / total;

  return (
    <Frame progress={progress} step={`${index + 1} of ${total}`} deeper={phase === "deeper"}>
      <QuestionCard
        key={`${phase}-${card.field}`}
        card={card}
        answers={answers}
        pending={pending}
        activeSeat={activeSeat}
        canSwitchSeat={demo}
        onChoose={choose}
      />
      <SkipRow onSkip={skip} />
    </Frame>
  );
}

function Frame({
  children,
  progress,
  step,
  deeper,
}: {
  children: React.ReactNode;
  progress: number;
  step?: string;
  deeper?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="px-[var(--pad-x)] pt-5">
        <div className="flex items-center justify-between pb-2">
          <span className="eyebrow">{deeper ? "A little deeper" : "Setup"}</span>
          {step && <span className="eyebrow">{step}</span>}
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--mint-deep)" }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function QuestionCard({
  card,
  answers,
  pending,
  activeSeat,
  canSwitchSeat,
  onChoose,
}: {
  card: PrefCard;
  answers: Answers;
  pending: string | null;
  activeSeat: SeatId;
  canSwitchSeat: boolean;
  onChoose: (field: string, value: string, isSeat?: boolean) => void;
}) {
  const isSeat = Boolean(card.seatPicker);
  const current = isSeat ? String(activeSeat) : answers[card.field];

  return (
    <div
      key={card.field}
      className="rise flex min-h-0 flex-1 flex-col justify-center gap-6 px-[var(--pad-x)]"
    >
      <div className="flex flex-col gap-2">
        <h2 className={card.emphasis ? "t-display text-ink" : "t-title text-ink"}>
          {card.question}
        </h2>
        {card.helper && <p className="t-body text-ink3">{card.helper}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        {(isSeat ? SEAT_CARD.options : card.options).map((opt) => {
          const selected = current === opt.value;
          const isPending = pending === opt.value;
          const locked = isSeat && !canSwitchSeat && opt.value !== String(activeSeat);
          return (
            <button
              key={opt.value}
              disabled={locked}
              onClick={() => onChoose(card.field, opt.value, isSeat)}
              className={`flex min-h-[52px] w-full items-center justify-between rounded-[var(--r-md)] border px-4 py-3 text-left text-[16px] font-medium transition-colors ${isPending ? "pop" : ""} disabled:opacity-40`}
              style={
                isPending
                  ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }
                  : selected
                    ? { background: "var(--mint-wash)", borderColor: "var(--mint-bd)", color: "var(--ink)" }
                    : { borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              <span>{opt.label}</span>
              {selected && !isPending && (
                <span style={{ color: "var(--mint-deep)" }}>
                  <Icon name="decision" size={18} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkipRow({ onSkip, label = "Skip" }: { onSkip: () => void; label?: string }) {
  return (
    <div className="flex justify-center px-[var(--pad-x)] pb-7 pt-3">
      <button onClick={onSkip} className="t-secondary font-medium text-ink3">
        {label}
      </button>
    </div>
  );
}
