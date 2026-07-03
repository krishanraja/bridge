import { TabBar } from "@/components/rooms/TabBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <main className="room">{children}</main>
      <TabBar />
    </div>
  );
}
