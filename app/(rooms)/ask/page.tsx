import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { AskRoom } from "@/components/rooms/AskRoom";
import { getSeatPrefs } from "@/lib/data";
import { autonomyFor } from "@/lib/prefs/autonomy";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  /* The seat's trust setting decides whether a command is confirmed or handled. */
  const prefs = await getSeatPrefs(seat);
  const autonomy = autonomyFor(prefs);
  return <AskRoom operator={seat === 4} autonomy={autonomy} />;
}
