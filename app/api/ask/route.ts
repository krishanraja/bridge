/* Ask: intent routed, grounded, streamed. Commands come back as structured
   intents for the client's confirm card; questions stream a cited answer. */

import { NextResponse, type NextRequest } from "next/server";
import { currentSeat } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { routeIntent } from "@/lib/voice/intent";
import { retrieve } from "@/lib/ground/retrieve";
import { MODELS } from "@/lib/intel/llm";
import { BANNED_LIST } from "@/lib/copy/banned";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FALLBACK = "Not in the house context. Want me to run a market sweep on it?";

export async function POST(req: NextRequest) {
  const seat = await currentSeat();
  if (!seat) return NextResponse.json({ error: "no seat" }, { status: 401 });

  const { q } = (await req.json()) as { q?: string };
  const query = (q ?? "").trim();
  if (!query) return NextResponse.json({ error: "empty" }, { status: 400 });

  const sb = await supabaseServer();
  const { data: priorities } = await sb
    .from("priorities")
    .select("id, name")
    .is("retired_at", null);

  /* Routing and retrieval run together; a question wastes nothing, a command
     wastes one cheap retrieval. First token speed is the product here. */
  const [intent, grounding] = await Promise.all([
    routeIntent(query, priorities ?? []),
    retrieve(query),
  ]);

  if (intent.kind !== "ask") {
    /* Resolve the move target server side so the confirm card is concrete. */
    if (intent.kind === "set_move") {
      const hint = intent.priority_hint.toLowerCase();
      const match = (priorities ?? []).find(
        (p) => hint && p.name.toLowerCase().includes(hint),
      ) ?? (priorities ?? [])[0];
      const { currentIsoWeek } = await import("@/lib/weeks");
      let existingMoveId: string | null = null;
      if (match) {
        const { data: mv } = await sb
          .from("moves")
          .select("id")
          .eq("priority_id", match.id)
          .eq("iso_week", currentIsoWeek())
          .maybeSingle();
        existingMoveId = mv?.id ?? null;
      }
      return NextResponse.json({
        intent: {
          ...intent,
          priority_id: match?.id ?? null,
          priority_name: match?.name ?? null,
          existing_move_id: existingMoveId,
        },
      });
    }
    return NextResponse.json({ intent });
  }

  const system = `You are BRIDGE, the fifth seat at Amperity's leadership table. Answer from the house context below and from nothing else. Cite with reference markers like [S3] or [P2] placed after the claims they support. Never use a reference code as a noun; name the thing in plain words and put the marker after it. Plain speech, short sentences first, a plain verdict. No em dashes, none of these words: ${BANNED_LIST}. Keep answers under 150 words.
If the context cannot ground an answer, reply with exactly: ${FALLBACK}

HOUSE CONTEXT
${grounding.context}`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.synth,
      max_tokens: 700,
      stream: true,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "the model did not answer" }, { status: 502 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  /* The watchdog counts TEXT progress, not socket activity: upstream pings
     keep the connection warm while rate limit pacing can stall tokens for
     minutes. If no new text lands inside the window, the answer ends cleanly
     where it stands instead of hanging the room. */
  const IDLE_MS = 15000;
  let lastText = Date.now();

  const readWithWatchdog = () =>
    Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) => {
        const t = setInterval(() => {
          if (Date.now() - lastText > IDLE_MS) {
            clearInterval(t);
            resolve({ done: true, value: undefined });
          }
        }, 1000);
      }),
    ]);

  const stream = new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await readWithWatchdog();
        if (done) {
          controller.close();
          void reader.cancel().catch(() => {});
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let wrote = false;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              controller.enqueue(encoder.encode(evt.delta.text));
              lastText = Date.now();
              wrote = true;
            }
          } catch {
            /* keepalives and partial frames */
          }
        }
        if (wrote) return;
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-intent": "ask",
      "x-citations": Buffer.from(JSON.stringify(grounding.citations)).toString("base64"),
    },
  });
}
