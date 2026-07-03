/* The dial. One instrument, three sizes. The product's signature element:
   a 270 degree arc, a hero numeral in Space Grotesk, a quiet label beneath. */

const SIZES = {
  hero: { px: 192, stroke: 11, numeral: 52, showTicks: true, showLabel: true },
  standard: { px: 74, stroke: 6, numeral: 22, showTicks: false, showLabel: true },
  micro: { px: 38, stroke: 4, numeral: 12.5, showTicks: false, showLabel: false },
} as const;

export type DialSize = keyof typeof SIZES;

interface DialProps {
  value: number;
  size?: DialSize;
  label?: string;
  delta?: number | null;
  atRisk?: boolean;
}

export function Dial({ value, size = "standard", label, delta, atRisk }: DialProps) {
  const cfg = SIZES[size];
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = (cfg.px - cfg.stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75 * c;
  const filled = (v / 100) * arc;
  const cx = cfg.px / 2;
  const risky = atRisk ?? v < 35;

  const ticks = cfg.showTicks
    ? Array.from({ length: 11 }, (_, i) => {
        const angle = (135 + i * 27) * (Math.PI / 180);
        const r1 = r - cfg.stroke - 3;
        const r2 = r1 - (i % 5 === 0 ? 7 : 4);
        return {
          x1: cx + r1 * Math.cos(angle),
          y1: cx + r1 * Math.sin(angle),
          x2: cx + r2 * Math.cos(angle),
          y2: cx + r2 * Math.sin(angle),
        };
      })
    : [];

  return (
    <div
      className="relative inline-flex flex-col items-center"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label ?? "confidence"}
    >
      <svg width={cfg.px} height={cfg.px} viewBox={`0 0 ${cfg.px} ${cfg.px}`}>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          transform={`rotate(135 ${cx} ${cx})`}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={risky ? "var(--risk)" : "var(--dial-arc, var(--mint-deep))"}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(135 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 200ms ease-out" }}
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            {...t}
            stroke="var(--ink-3)"
            strokeWidth={1}
            opacity={0.55}
          />
        ))}
      </svg>
      <div
        className="num-display absolute inset-0 flex items-center justify-center"
        style={{ fontSize: cfg.numeral, fontWeight: 500 }}
      >
        {v}
      </div>
      {cfg.showLabel && (label || delta != null) && (
        <div className="mt-1 flex items-baseline gap-1.5">
          {label && <span className="eyebrow">{label}</span>}
          {delta != null && delta !== 0 && (
            <span
              className="num-display text-[10.5px] font-medium"
              style={{ color: delta > 0 ? "var(--mint-deep)" : "var(--risk)" }}
            >
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
