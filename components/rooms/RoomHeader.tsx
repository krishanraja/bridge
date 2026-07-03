interface RoomHeaderProps {
  eyebrow: string;
  title?: string;
  right?: React.ReactNode;
}

export function RoomHeader({ eyebrow, title, right }: RoomHeaderProps) {
  return (
    <header className="flex items-start justify-between px-5 pt-4 pb-1">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        {title && (
          <div className="num-display text-[27px] font-medium leading-tight">
            {title}
          </div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 pt-0.5">{right}</div>}
    </header>
  );
}
