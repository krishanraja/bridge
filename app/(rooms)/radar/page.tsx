import Link from "next/link";
import { redirect } from "next/navigation";
import { getDeck } from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { Deck } from "@/components/rooms/Deck";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const deck = await getDeck();
  const operator = seat === 4;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between px-5 pt-4 pb-1">
        <div className="eyebrow">Radar</div>
        <Link
          href="/ledger"
          aria-label="Open the assumption ledger"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 3v18M5 7l7-4 7 4M7 21h10" />
            <path d="M5 7v10l2 2M19 7v10l-2 2" />
          </svg>
        </Link>
      </header>
      <Deck signals={deck} operator={operator} />
    </div>
  );
}
