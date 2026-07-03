import "server-only";
import { isDemoMode, hasSupabaseEnv } from "@/lib/mode";
import { seatForEmail, type SeatId } from "@/lib/seats";

/* The signed-in seat, or null. Demo mode runs as the operator. */
export async function currentSeat(): Promise<SeatId | null> {
  if (isDemoMode() || !hasSupabaseEnv()) return 4;
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;
  return seatForEmail(user.email);
}
