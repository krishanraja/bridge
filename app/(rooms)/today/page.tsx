import {
  getToday,
  getDeck,
  getPriorities,
  getTable,
  getDecisionLog,
  getThemes,
} from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PresenceDots } from "@/components/rooms/PresenceDots";
import { BriefBlock } from "@/components/rooms/BriefBlock";
import { FocusCard } from "@/components/rooms/FocusCard";
import { OperatorInbox } from "@/components/rooms/OperatorInbox";
import { ReviewCard } from "@/components/rooms/ReviewCard";
import { CommandCenter } from "@/components/rooms/CommandCenter";
import { Icon } from "@/components/ui/Icon";
import { LANES } from "@/lib/copy/lanes";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  /* One fetch feeds both surfaces: the phone Today reads the first field, the
     desktop command center fans across the rest. All getters are independent and
     force-dynamic-safe, so they resolve together. */
  const [data, deck, priorities, table, decisions, themes] = await Promise.all([
    getToday(),
    getDeck(),
    getPriorities(),
    getTable(),
    getDecisionLog(),
    getThemes(),
  ]);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const asOf = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      {/* Desktop: the cockpit. Hidden on the phone, where Today stays a task list. */}
      <div className="only-desktop h-full min-h-0">
        <CommandCenter
          seat={seat}
          today={data}
          deck={deck}
          priorities={priorities}
          table={table}
          decisions={decisions}
          themes={themes}
          asOf={asOf}
        />
      </div>

      {/* Phone: unchanged, one thing at a time. Hidden on desktop. */}
      <div className="only-mobile flex h-full min-h-0 flex-col gap-3 pb-3">
      <header className="flex items-start justify-between px-5 pt-4">
        <div>
          <div className="eyebrow">Today{data.demo ? " · Sample" : ""}</div>
          <div className="num-display text-[31px] font-medium leading-tight">
            {dateLabel}
          </div>
        </div>
        <div className="flex items-center gap-2.5 pt-1.5">
          <PresenceDots demo={data.demo} currentSeat={seat} seedPresent={[2, 3]} />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink3 transition-colors active:bg-paper"
          >
            <Icon name="settings" size={18} strokeWidth={1.6} />
          </Link>
        </div>
      </header>

      {/* A calm, top-aligned canvas: the hero leads and holds the first screen,
         the rest flows below to be explored with a gentle scroll rather than
         crammed in. Inner scroll only, so the page itself never scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-4 [scrollbar-width:none]">
        {/* The hero: the one clear thing. Falls back to the brief on a quiet day,
           or to the operator's draft review when there is one to release. */}
        {data.review ? (
          <ReviewCard review={data.review} />
        ) : data.focus ? (
          <div className="mx-5">
            <FocusCard focus={data.focus} seat={seat} />
          </div>
        ) : (
          <BriefBlock brief={data.brief} />
        )}

        {/* The operator's inbox: signals leaders acted on, waiting to become
           moves. Operator only; empty for principals. */}
        {seat === 4 && (
          <OperatorInbox
            routed={data.routed}
            priorities={data.weekMoves.map((m) => ({ id: m.priorityId, name: m.priorityName }))}
          />
        )}

        {/* The calm secondary tier, demoted below the hero. The brief only
           appears here when it is not already the hero. */}
        {!data.review && data.focus && (
          <BriefBlock brief={data.brief} compact />
        )}

        <section className="mx-5 min-h-0 overflow-hidden rise rise-2">
          <div className="eyebrow mb-1.5">On the radar</div>
          <div className="flex flex-col gap-1.5">
            {data.topSignals.length === 0 && (
              <p className="text-[14px] text-ink3">
                Quiet on the market today, nothing that needed your eyes.
              </p>
            )}
            {data.topSignals.slice(0, 2).map((s) => (
              <Link
                key={s.id}
                href="/radar"
                className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    color: `var(${LANES[s.lane].cssVar})`,
                    background: "var(--bg)",
                  }}
                >
                  <Icon name={LANES[s.lane].icon} size={14} strokeWidth={1.7} />
                </span>
                <span className="truncate text-[14px] leading-tight text-ink2">
                  {s.headline}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-5 flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-2.5 rise rise-3">
          <span className="eyebrow">The week</span>
          <Link href="/priorities" className="flex items-center gap-2">
            {data.weekMoves.map((m) => (
              <span
                key={m.priorityId}
                title={m.priorityName}
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background:
                    m.state === "shipped"
                      ? "var(--mint)"
                      : m.state === "missed"
                        ? "var(--risk)"
                        : m.state === "none"
                          ? "transparent"
                          : "var(--mint-wash)",
                  border:
                    m.state === "shipped"
                      ? "1px solid var(--mint-deep)"
                      : m.state === "missed"
                        ? "1px solid var(--risk)"
                        : "1px solid var(--ink-3)",
                }}
              />
            ))}
          </Link>
        </section>
      </div>
      </div>
    </>
  );
}
