/* Register or drop a push subscription for the current seat. */

import { NextResponse, type NextRequest } from "next/server";
import { currentSeat } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (!seat) return NextResponse.json({ error: "no seat" }, { status: 401 });

  const { subscription } = (await req.json()) as { subscription?: unknown };
  if (!subscription) return NextResponse.json({ error: "no subscription" }, { status: 400 });

  const sb = await supabaseServer();
  const endpoint = (subscription as { endpoint?: string }).endpoint;
  if (endpoint) {
    const { data: existing } = await sb
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("seat", seat);
    const dupe = (existing ?? []).some(
      (r) => (r.subscription as { endpoint?: string }).endpoint === endpoint,
    );
    if (dupe) return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await sb.from("push_subscriptions").insert({ seat, subscription });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
