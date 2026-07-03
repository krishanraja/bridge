import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { AskRoom } from "@/components/rooms/AskRoom";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  return <AskRoom />;
}
