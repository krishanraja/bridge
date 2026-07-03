/* Audio in, text out. The raw clip is transcribed and discarded, never stored. */

import { NextResponse, type NextRequest } from "next/server";
import { currentSeat } from "@/lib/auth";
import { transcribe } from "@/lib/voice/stt";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (!seat) return NextResponse.json({ error: "no seat" }, { status: 401 });

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }
  if (audio.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "too long" }, { status: 413 });
  }

  try {
    const result = await transcribe(audio, (audio as File).name || "audio.webm");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message.slice(0, 200) },
      { status: 502 },
    );
  }
}
