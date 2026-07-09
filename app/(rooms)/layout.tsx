import { redirect } from "next/navigation";
import { AppShell } from "@/components/rooms/AppShell";
import { useSeedData } from "@/lib/mode";
import { currentSeat } from "@/lib/auth";
import { getSeatPrefs } from "@/lib/data";

/* First run: a seat that has not finished the setup wizard is sent to it once,
   right after sign in. Demo skips this (the sample seats are already filled). */
export default async function RoomsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!useSeedData()) {
    const seat = await currentSeat();
    if (seat) {
      const prefs = await getSeatPrefs(seat);
      if (!prefs?.completed_at) redirect("/setup");
    }
  }
  return <AppShell>{children}</AppShell>;
}
