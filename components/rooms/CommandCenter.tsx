/* The desktop command center. Where the phone is a task instrument — triage one
   card, cast one pulse, log one decision — the desktop is a cockpit a leader
   glances at all day: the one call, the morning read, the market, the priorities,
   the table's alignment, the recent decisions and what the market keeps returning
   to, all on one calm surface. It composes the same pieces the phone already uses,
   re-laid for a wide screen. Rendered only on desktop (CSS gates .only-desktop). */

import type { SeatId } from "@/lib/seats";
import { SEATS } from "@/lib/seats";
import type { Decision } from "@/lib/types";
import type {
  TodayData,
  DeckView,
  PriorityView,
  TableData,
  ThemeView,
  DecisionReceipt,
} from "@/lib/data/views";
import { LANES, type LaneId } from "@/lib/copy/lanes";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Dial } from "@/components/dial/Dial";
import { FocusCard } from "@/components/rooms/FocusCard";
import { BriefBlock } from "@/components/rooms/BriefBlock";
import { PresenceDots } from "@/components/rooms/PresenceDots";
import { CommandMarket } from "@/components/rooms/CommandMarket";
import { CommandAlignment } from "@/components/rooms/CommandAlignment";

const EMPTY_RECEIPT: DecisionReceipt = { seen: [], concurred: [], feedback: [] };

/* The table's read on a decision at a glance, mirroring the phone Table room. */
function consensusOf(rec: DecisionReceipt): { label: string; color: string } | null {
  const c = rec.concurred.length;
  const f = rec.feedback.length;
  if (c === 0 && f === 0) return null;
  if (f === 0 && c >= 2) return { label: "Aligned", color: "var(--mint-deep)" };
  if (f > 0 && c === 0) return { label: "Pushback", color: "var(--risk)" };
  if (f > 0) return { label: "Split", color: "var(--amber)" };
  return { label: "Forming", color: "var(--ink-3)" };
}

const DECISION_STATE: Record<Decision["state"], { label: string; color: string }> = {
  open: { label: "Open", color: "var(--ink-3)" },
  done: { label: "Done", color: "var(--mint-deep)" },
  dropped: { label: "Dropped", color: "var(--risk)" },
};

function Panel({
  label,
  right,
  children,
  className = "",
  style,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`} style={style}>
      <SectionLabel right={right}>{label}</SectionLabel>
      {children}
    </Card>
  );
}

export function CommandCenter({
  seat,
  today,
  deck,
  priorities,
  table,
  decisions,
  themes,
  asOf,
}: {
  seat: SeatId;
  today: TodayData;
  deck: DeckView;
  priorities: PriorityView[];
  table: TableData;
  decisions: Decision[];
  themes: ThemeView[];
  asOf: string;
}) {
  const name = SEATS[seat].shortName;
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const split = table.widestSplit;
  const topPriorities = priorities.slice(0, 4);
  const recentDecisions = decisions.slice(0, 4);
  const topThemes = [...themes]
    .sort((a, b) => b.acceleration - a.acceleration)
    .slice(0, 5);

  return (
    <div className="command px-[var(--pad-x)] pb-10 pt-7">
      {/* The top strip: who, when, who is at the table, and the freshness stamp. */}
      <header className="mb-6 flex items-end justify-between rise">
        <div>
          <div className="eyebrow" style={{ color: "var(--mint-deep)" }}>
            {today.demo ? "Command · Sample" : "Command"}
          </div>
          <h1 className="num-display mt-1 text-[var(--t-display)] font-medium leading-tight text-ink">
            {salutation}, {name}
          </h1>
          <p className="t-secondary mt-0.5 text-ink3">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="eyebrow">At the table</div>
            <div className="mt-1.5">
              <PresenceDots demo={today.demo} currentSeat={seat} seedPresent={[2, 3]} />
            </div>
          </div>
          <div className="h-9 w-px" style={{ background: "var(--line)" }} />
          <div className="text-right">
            <div className="eyebrow">As of</div>
            <div className="num-display mt-0.5 text-[15px] font-medium text-ink">{asOf}</div>
          </div>
        </div>
      </header>

      {/* The cockpit grid: the one call and the market lead the left rail; the read,
         the priorities, the alignment and the record stack down the right. */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-5">
        {/* Left rail. */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rise rise-1">
            <div className="eyebrow mb-2" style={{ color: "var(--mint-deep)" }}>
              The one call
            </div>
            {today.focus ? (
              <FocusCard focus={today.focus} seat={seat} />
            ) : (
              <Card className="flex flex-col gap-2">
                <p className="t-headline text-ink">A quiet board today.</p>
                <p className="t-secondary text-ink3">
                  Nothing forced a single call. Read the market below and set the week.
                </p>
              </Card>
            )}
          </div>

          <Panel label="The market" className="rise rise-2">
            <CommandMarket signals={deck.signals} />
          </Panel>
        </div>

        {/* Right rail. */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel label="The morning read" className="rise rise-1">
            <BriefBlockDesktop hasBrief={Boolean(today.brief)}>
              <BriefBlock brief={today.brief} compact />
            </BriefBlockDesktop>
          </Panel>

          <Panel label="Priorities" className="rise rise-2">
            <div className="grid grid-cols-2 gap-3">
              {topPriorities.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-line bg-bg px-2 py-3 text-center"
                >
                  <Dial
                    value={p.confidence ?? 0}
                    size="standard"
                    delta={p.confidenceDelta}
                    atRisk={p.state === "at_risk" || p.state === "blocked"}
                  />
                  <div className="min-w-0">
                    <p className="t-label line-clamp-1 font-medium text-ink">{p.name}</p>
                    {p.move && (
                      <p className="t-label line-clamp-1 text-ink3">{p.move.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel label="Alignment" className="rise rise-3">
            <CommandAlignment data={table} />
            {split && (
              <p className="t-label text-ink3">
                Widest split on{" "}
                <span className="font-medium text-ink2">{split.priorityName}</span>:{" "}
                {SEATS[split.highSeat].shortName} at {split.highVal},{" "}
                {SEATS[split.lowSeat].shortName} at {split.lowVal}.
              </p>
            )}
          </Panel>

          <Panel label="Recent decisions" className="rise rise-3">
            {recentDecisions.length === 0 ? (
              <p className="t-label text-ink3">No decisions logged yet this week.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentDecisions.map((d) => {
                  const rec = table.decisionReceipts[d.id] ?? EMPTY_RECEIPT;
                  const con = consensusOf(rec);
                  const st = DECISION_STATE[d.state];
                  return (
                    <div key={d.id} className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: st.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="t-label line-clamp-2 leading-snug text-ink">{d.text}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="eyebrow">{SEATS[d.owner_seat].shortName}</span>
                          {con && (
                            <Chip color={con.color}>{con.label}</Chip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel label="What is building" className="rise rise-3">
            {topThemes.length === 0 ? (
              <p className="t-label text-ink3">
                No standing themes yet. They form as the market repeats itself.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {topThemes.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{
                        color:
                          t.lane != null
                            ? `var(${LANES[t.lane as LaneId].cssVar})`
                            : "var(--mint-deep)",
                        background: "var(--bg)",
                      }}
                    >
                      <Icon
                        name={t.lane != null ? LANES[t.lane as LaneId].icon : "sparkle"}
                        size={14}
                        strokeWidth={1.7}
                      />
                    </span>
                    <span className="t-label min-w-0 flex-1 truncate text-ink">{t.label}</span>
                    <span className="eyebrow shrink-0">{t.member_count} signals</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* The compact BriefBlock centres its own content with mx-5; inside a desktop
   panel we want it flush, so this unwraps that inset without touching the shared
   component. */
function BriefBlockDesktop({
  hasBrief,
  children,
}: {
  hasBrief: boolean;
  children: React.ReactNode;
}) {
  if (!hasBrief) {
    return (
      <p className="t-label leading-snug text-ink3">
        The morning read lands each weekday around half past seven.
      </p>
    );
  }
  return <div className="[&_section]:mx-0">{children}</div>;
}
