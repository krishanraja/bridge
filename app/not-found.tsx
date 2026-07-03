import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="num-display text-[33px] font-medium text-ink">Off the map</div>
      <p className="text-[15px] text-ink2">
        There is no room here. The five are Today, Radar, Priorities, Table,
        and Ask.
      </p>
      <Link
        href="/today"
        className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg"
      >
        Back to Today
      </Link>
    </div>
  );
}
