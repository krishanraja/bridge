import "server-only";
import { isDemoMode, hasSupabaseEnv } from "@/lib/mode";
import { seatForEmail, type SeatId } from "@/lib/seats";

/* The signed-in seat, or null. In demo mode the sample runs as Kabir (seat 1),
   the leader it is shown to, so the sample reads as his own view. */
export async function currentSeat(): Promise<SeatId | null> {
  if (isDemoMode() || !hasSupabaseEnv()) return 1;
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;
  return seatForEmail(user.email);
}
