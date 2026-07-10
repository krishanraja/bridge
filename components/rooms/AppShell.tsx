import { TabBar } from "@/components/rooms/TabBar";
import { SideNav } from "@/components/rooms/SideNav";
import { currentSeat } from "@/lib/auth";
import { useSeedData } from "@/lib/mode";

/* The frame. On the phone it is a content region over a bottom tab bar; on the
   desktop the same tree becomes a left rail plus a stage, gated purely in CSS by
   data-desktop, so both nav elements render and the layout picks one. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const seat = await currentSeat();
  const demo = useSeedData();
  return (
    <div className="app-shell">
      <SideNav seat={seat} demo={demo} />
      <main className="room">{children}</main>
      <TabBar />
    </div>
  );
}
