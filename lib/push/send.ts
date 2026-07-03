/* Web Push. Rationed by section 8.6: one morning brief, the Monday pulse open,
   the Friday close, and at most one interrupt per week. The ledger of what was
   sent lives in events, so the ration is enforced, not hoped for. */

import "server-only";
import webpush from "web-push";
import { supabaseService } from "@/lib/supabase/service";
import type { SeatId } from "@/lib/seats";

export type PushKind = "morning" | "pulse_open" | "close" | "drift" | "interrupt";

function configured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:krish@themindmaker.ai", pub, priv);
  return true;
}

async function alreadySent(seat: SeatId, kind: PushKind, sinceISO: string): Promise<boolean> {
  const sb = supabaseService();
  const { count } = await sb
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("seat", seat)
    .eq("type", "push_sent")
    .eq("subject_id", kind)
    .gte("created_at", sinceISO);
  return (count ?? 0) > 0;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/* Send to one seat, respecting the ration window for that kind. */
export async function pushToSeat(
  seat: SeatId,
  kind: PushKind,
  message: PushMessage,
): Promise<{ sent: number; skipped: string | null }> {
  if (!configured()) return { sent: 0, skipped: "push not configured" };

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const window = kind === "interrupt" ? weekAgo : dayAgo;
  if (await alreadySent(seat, kind, window)) {
    return { sent: 0, skipped: `${kind} already sent in window` };
  }

  const sb = supabaseService();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("seat", seat);

  let sent = 0;
  for (const row of subs ?? []) {
    try {
      await webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify(message),
      );
      sent++;
    } catch (e) {
      /* A gone subscription is pruned so the list stays clean. */
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sb.from("push_subscriptions").delete().eq("id", row.id);
      }
    }
  }

  if (sent > 0) {
    await sb.from("events").insert({
      seat,
      type: "push_sent",
      subject_type: "push",
      subject_id: kind,
      value: { title: message.title },
    });
  }
  return { sent, skipped: sent === 0 ? "no live subscriptions" : null };
}
