import { redirect } from "next/navigation";
import { getPriorities } from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { PriorityBoard } from "@/components/rooms/PriorityBoard";

export const dynamic = "force-dynamic";

export default async function PrioritiesPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const priorities = await getPriorities();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between px-5 pt-4 pb-1">
        <div className="eyebrow">Priorities</div>
        <span className="eyebrow">{priorities.length} of 5</span>
      </header>
      <PriorityBoard priorities={priorities} seat={seat} />
    </div>
  );
}
