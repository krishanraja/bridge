/* Text in, signed audio URL out, cached by content hash. */

import { NextResponse, type NextRequest } from "next/server";
import { currentSeat } from "@/lib/auth";
import { speak } from "@/lib/voice/tts";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (!seat) return NextResponse.json({ error: "no seat" }, { status: 401 });

  const { text } = (await req.json()) as { text?: string };
  const clean = (text ?? "").trim().slice(0, 4000);
  if (!clean) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const { url } = await speak(clean);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message.slice(0, 160) },
      { status: 503 },
    );
  }
}
