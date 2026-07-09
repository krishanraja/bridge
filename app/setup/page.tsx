import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { getSeatPrefs, getAllSeatPrefs } from "@/lib/data";
import { useSeedData } from "@/lib/mode";
import { SetupWizard } from "@/components/rooms/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; from?: string }>;
}) {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const demo = useSeedData();
  const prefs = await getSeatPrefs(seat);
  const allPrefs = demo ? await getAllSeatPrefs() : [];
  const sp = await searchParams;

  return (
    <SetupWizard
      seat={seat}
      initialPrefs={prefs}
      allPrefs={allPrefs}
      demo={demo}
      startField={typeof sp.card === "string" ? sp.card : undefined}
      returnTo={sp.from === "settings" ? "/settings" : "/today"}
    />
  );
}
