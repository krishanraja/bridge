import { Icon, type IconName } from "@/components/ui/Icon";

interface ChipProps {
  children: React.ReactNode;
  color?: string;
  filled?: boolean;
  onClick?: () => void;
  active?: boolean;
  icon?: IconName;
}

export function Chip({ children, color, filled, onClick, active, icon }: ChipProps) {
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
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium tracking-[0.02em] whitespace-nowrap";

  const inner = (
    <>
      {icon && <Icon name={icon} size={13} strokeWidth={1.9} />}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={cls} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} style={style}>
      {inner}
    </span>
  );
}
