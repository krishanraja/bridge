/* The preference graph. One glance shows the pattern behind each leader and the
   pattern behind the table: eight lanes down, one column per seat plus the whole
   table, each cell tinted by how much that leader leans into or waves off the
   lane. Mint is appetite, a red wash is avoidance. Built from the same reactions
   the deck already learns from, so it is the app's taste made legible. */

import type { PreferenceGraphData } from "@/lib/learn/reflection";
import { LANES, LANE_IDS } from "@/lib/copy/lanes";
import { SEATS, SEAT_IDS } from "@/lib/seats";
import { Icon } from "@/components/ui/Icon";

function tint(v: number): React.CSSProperties {
  if (v >= 0.35) return { background: "var(--mint)" };
  if (v >= 0.12) return { background: "var(--mint-wash)", boxShadow: "inset 0 0 0 1px var(--mint-bd)" };
  if (v <= -0.35) return { background: "var(--risk-wash)", boxShadow: "inset 0 0 0 1.5px var(--risk)" };
  if (v <= -0.12) return { background: "var(--risk-wash)" };
  return { background: "transparent", boxShadow: "inset 0 0 0 1px var(--line)" };
}

export function PreferenceGraph({ data }: { data: PreferenceGraphData }) {
  const cols = `22px repeat(${SEAT_IDS.length + 1}, minmax(0, 1fr))`;
  return (
    <div className="flex flex-col gap-2">
      {/* Column header: each seat, then the table. */}
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
        <span />
        {SEAT_IDS.map((s) => (
          <span key={s} className="text-center text-[11px] font-semibold text-ink3">
            {SEATS[s].initials}
          </span>
        ))}
        <span className="text-center text-[11px] font-semibold text-ink2">All</span>
      </div>

      {LANE_IDS.map((lane) => (
        <div
          key={lane}
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: cols }}
        >
          <span
            title={LANES[lane].name}
            className="flex items-center justify-center"
            style={{ color: `var(${LANES[lane].cssVar})` }}
          >
            <Icon name={LANES[lane].icon} size={15} />
          </span>
          {SEAT_IDS.map((s) => (
            <span
              key={s}
              title={`${SEATS[s].shortName} · ${LANES[lane].name}`}
              className="h-6 rounded-[6px]"
              style={tint(data.perSeat[s].perLane[lane] ?? 0)}
            />
          ))}
          <span
            title={`The table · ${LANES[lane].name}`}
            className="h-6 rounded-[6px]"
            style={tint(data.group.perLane[lane] ?? 0)}
          />
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ background: "var(--mint)" }} />
          <span className="t-label text-ink3">Leans in</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-[4px]"
            style={{ background: "var(--risk-wash)", boxShadow: "inset 0 0 0 1.5px var(--risk)" }}
          />
          <span className="t-label text-ink3">Waves off</span>
        </span>
      </div>
    </div>
  );
}
