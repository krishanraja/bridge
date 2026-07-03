interface ChipProps {
  children: React.ReactNode;
  color?: string;
  filled?: boolean;
  onClick?: () => void;
  active?: boolean;
}

export function Chip({ children, color, filled, onClick, active }: ChipProps) {
  const style: React.CSSProperties = color
    ? filled
      ? { background: color, color: "#fff", border: `1px solid ${color}` }
      : { color, border: `1px solid ${color}` }
    : active
      ? {
          background: "var(--mint-wash)",
          border: "1px solid var(--mint-bd)",
          color: "var(--ink)",
        }
      : { border: "1px solid var(--line)", color: "var(--ink-2)" };

  const cls =
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium tracking-[0.02em] whitespace-nowrap";

  if (onClick) {
    return (
      <button onClick={onClick} className={cls} style={style}>
        {children}
      </button>
    );
  }
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
