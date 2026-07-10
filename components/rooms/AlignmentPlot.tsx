import type { TableData } from "@/lib/data/views";

/* Alignment: confidence across, spread up. A roomy plot with de-overlapped
   markers, so a tight cluster stays legible. Names live one tap away. Shared by
   the phone Table room and the desktop command center. */
export function AlignmentPlot({
  data,
  onDot,
}: {
  data: TableData;
  onDot: (id: string) => void;
}) {
  const W = 340;
  const H = 208;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 30;
  const maxSpread = 60;
  const R = 12;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  /* Place, then relax overlaps deterministically so equal reads don't collide. */
  const pts = data.plot.map((p, i) => ({
    i,
    id: p.priorityId,
    x: padL + (p.mean / 100) * plotW,
    y: padT + plotH - (Math.min(p.spread, maxSpread) / maxSpread) * (plotH - R),
    tight: p.spread <= 15 && p.mean >= 60,
  }));
  const minGap = 2 * R + 2;
  for (let iter = 0; iter < 4; iter++) {
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        let dx = pts[b].x - pts[a].x;
        let dy = pts[b].y - pts[a].y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        if (dist < minGap) {
          const push = (minGap - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          pts[a].x -= ux * push;
          pts[a].y -= uy * push;
          pts[b].x += ux * push;
          pts[b].y += uy * push;
        }
      }
    }
  }
  /* Keep dots inside the plot after nudging. */
  for (const pt of pts) {
    pt.x = Math.max(padL + R, Math.min(W - padR - R, pt.x));
    pt.y = Math.max(padT + R, Math.min(padT + plotH - R, pt.y));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* The good zone: high confidence, low spread. */}
      <rect
        x={padL + plotW * 0.6}
        y={padT}
        width={plotW * 0.4}
        height={plotH * 0.42}
        rx={6}
        fill="var(--mint-wash)"
      />
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--line)" />
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="var(--line)" />
      <text
        x={W - padR}
        y={H - 10}
        textAnchor="end"
        fill="var(--ink-3)"
        fontSize="11"
      >
        confidence →
      </text>
      <text
        x={12}
        y={padT + plotH}
        fill="var(--ink-3)"
        fontSize="11"
        transform={`rotate(-90 12 ${padT + plotH})`}
      >
        spread ↑
      </text>
      {pts.map((pt) => (
        <g
          key={pt.id}
          onClick={() => onDot(pt.id)}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={pt.x}
            cy={pt.y}
            r={R}
            fill={pt.tight ? "var(--mint)" : "var(--paper)"}
            stroke={pt.tight ? "var(--mint-deep)" : "var(--ink-2)"}
            strokeWidth={1.6}
          />
          <text
            x={pt.x}
            y={pt.y + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight={600}
            fill="var(--ink)"
          >
            {pt.i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
