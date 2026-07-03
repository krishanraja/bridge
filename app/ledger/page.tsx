import Link from "next/link";
import { redirect } from "next/navigation";
import { getLedger } from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { LedgerDeck } from "@/components/rooms/LedgerDeck";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const data = await getLedger();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between px-5 pt-4 pb-1">
        <div>
          <div className="eyebrow">The house view</div>
        </div>
        <Link
          href="/radar"
          className="eyebrow underline underline-offset-2"
        >
          Back to radar
        </Link>
      </header>
      <LedgerDeck assumptions={data.assumptions} />
    </div>
  );
}
