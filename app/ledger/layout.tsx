import { AppShell } from "@/components/rooms/AppShell";

export default function LedgerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
