import { AppShell } from "@/components/rooms/AppShell";

export default function RoomsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
