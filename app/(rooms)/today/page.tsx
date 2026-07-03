import { getToday } from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PresenceDots } from "@/components/rooms/PresenceDots";
import { BriefBlock } from "@/components/rooms/BriefBlock";
import { ReviewCard } from "@/components/rooms/ReviewCard";
import { LANES } from "@/lib/copy/lanes";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const data = await getToday();

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto_auto_auto] gap-2 pb-3">
      <header className="flex items-start justify-between px-5 pt-4">
        <div>
          <div className="eyebrow">Today{data.demo ? " · Sample" : ""}</div>
          <div className="num-display text-[22px] font-medium leading-tight">
            {dateLabel}
          </div>
        </div>
        <div className="pt-1.5">
          <PresenceDots demo={data.demo} currentSeat={seat} seedPresent={[1, 2]} />
        </div>
      </header>

      {data.review ? <ReviewCard review={data.review} /> : <BriefBlock brief={data.brief} />}

      {data.focus && (
        <section className="mx-5 rounded-xl border border-mint-bd bg-mint-wash px-4 py-3">
          <div className="eyebrow mb-1">Today&apos;s call to make</div>
          <p className="text-[14px] leading-snug text-ink">{data.focus.text}</p>
          <Link
            href={data.focus.href}
            className="mt-2 inline-flex items-center rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-medium text-bg"
          >
            {data.focus.actionLabel}
          </Link>
        </section>
      )}

      <section className="mx-5 min-h-0 overflow-hidden">
        <div className="eyebrow mb-1.5">On the radar</div>
        <div className="flex flex-col gap-1.5">
          {data.topSignals.length === 0 && (
            <p className="text-[12px] text-ink3">
              Quiet in the market today. That is a fact, not a failure.
            </p>
          )}
          {data.topSignals.map((s) => (
            <Link
              key={s.id}
              href="/radar"
              className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2"
            >
              <span
                className="h-5 w-1 shrink-0 rounded-full"
                style={{ background: `var(${LANES[s.lane].cssVar})` }}
              />
              <span className="truncate text-[12px] leading-tight text-ink2">
                {s.headline}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-5 flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-2.5">
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
  );
}
