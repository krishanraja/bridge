import { AppShell } from "@/components/rooms/AppShell";

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
