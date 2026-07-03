"use client";

/* Ask: hold to talk, or type. Questions stream back cited; commands come back
   as a confirm card. Voice in means voice out when the room can speak. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { Chip } from "@/components/ui/Chip";
import { SEATS, SEAT_IDS, type SeatId } from "@/lib/seats";
import { logDecision, undoRecentDecision, setMove, updateMove } from "@/app/actions";

interface Citation {
  ref: string;
  label: string;
  url: string | null;
  kind: string;
}

type CommandIntent = {
  kind: "log_decision" | "set_move" | "sweep" | "navigate";
  text?: string;
  owner_seat?: number;
  due_date?: string | null;
  priority_id?: string | null;
  priority_name?: string | null;
  existing_move_id?: string | null;
  topic?: string | null;
  room?: string;
};

type Phase =
  | { name: "idle" }
  | { name: "listening" }
  | { name: "thinking"; label: string }
  | { name: "answer"; text: string; citations: Citation[]; done: boolean }
  | { name: "confirm"; utterance: string; intent: CommandIntent }
  | { name: "logged"; message: string; undoId: string | null };

const GRAMMAR = [
  "Log a decision",
  "Set this week's move on a priority",
  "What changed on a lane this week",
  "Where do we disagree",
  "Brief me on a company",
];

const FALLBACK = "I do not have anything on that here.";

export function AskRoom({ operator }: { operator: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [typed, setTyped] = useState("");
  const [voiceSession, setVoiceSession] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1200) {
          setPhase({ name: "idle" });
          return;
        }
        setVoiceSession(true);
        setPhase({ name: "thinking", label: "One moment" });
        const form = new FormData();
        form.append("audio", blob, mime === "audio/webm" ? "a.webm" : "a.mp4");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        if (!res.ok) {
          setPhase({ name: "logged", message: "I did not quite catch that. Give it another go, or type it.", undoId: null });
          return;
        }
        const { text } = (await res.json()) as { text: string };
        if (!text) {
          setPhase({ name: "idle" });
          return;
        }
        await submit(text, true);
      };
      recorderRef.current = rec;
      rec.start();
      tick();
      setPhase({ name: "listening" });
    } catch {
      setPhase({
        name: "logged",
        message: "I cannot reach the microphone here. You can type it instead.",
        undoId: null,
      });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const submit = async (query: string, viaVoice: boolean) => {
    setPhase({ name: "thinking", label: "Having a look" });
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: query }),
    });

    if (!res.ok) {
      setPhase({ name: "logged", message: "Something went quiet on my end. Mind trying that again?", undoId: null });
      return;
    }

    const intentHeader = res.headers.get("x-intent");
    if (intentHeader !== "ask") {
      const { intent } = (await res.json()) as { intent: CommandIntent };
      if (intent.kind === "navigate" && intent.room) {
        router.push(`/${intent.room === "ask" ? "ask" : intent.room}`);
        setPhase({ name: "idle" });
        return;
      }
      setPhase({ name: "confirm", utterance: query, intent });
      return;
    }

    const citations = JSON.parse(
      atob(res.headers.get("x-citations") ?? "W10="),
    ) as Citation[];
    setPhase({ name: "answer", text: "", citations: [], done: false });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      const snapshot = full;
      setPhase({ name: "answer", text: snapshot, citations: [], done: false });
    }
    const used = citations.filter((c) => full.includes(`[${c.ref}]`));
    setPhase({ name: "answer", text: full, citations: used, done: true });

    if (viaVoice && !full.startsWith(FALLBACK)) {
      try {
        const tts = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: full.replace(/ ?\[[A-Z]\d+\]/g, "") }),
        });
        if (tts.ok) {
          const { url } = (await tts.json()) as { url: string };
          if (audioRef.current) {
            audioRef.current.src = url;
            void audioRef.current.play();
          }
        }
      } catch {
        /* the text twin is already on screen */
      }
    }
  };

  const confirmCommand = async (utterance: string, intent: CommandIntent) => {
    confirmHaptic();
    if (intent.kind === "log_decision") {
      const res = await logDecision({
        text: intent.text ?? "",
        owner_seat: (intent.owner_seat ?? 4) as SeatId,
        due_date: intent.due_date ?? null,
        logged_via: voiceSession ? "voice" : "typed",
        transcript: voiceSession ? utterance : null,
      });
      if (res.ok) {
        setPhase({
          name: "logged",
          message: `Got it, noted for ${SEATS[(intent.owner_seat ?? 4) as SeatId].shortName}${intent.due_date ? `, by ${intent.due_date}` : ""}.`,
          undoId: res.id ?? null,
        });
        undoTimer.current = setTimeout(() => {
          setPhase((p) =>
            p.name === "logged" ? { ...p, undoId: null } : p,
          );
        }, 15000);
      } else {
        setPhase({ name: "logged", message: res.message ?? "That did not save.", undoId: null });
      }
      return;
    }
    if (intent.kind === "set_move") {
      const res = intent.existing_move_id
        ? await updateMove({ id: intent.existing_move_id, text: intent.text ?? "" })
        : intent.priority_id
          ? await setMove({
              priority_id: intent.priority_id,
              text: intent.text ?? "",
              owner_seat: 4,
            })
          : { ok: false, message: "No priority matched." };
      setPhase({
        name: "logged",
        message: res.ok
          ? `The move on ${intent.priority_name ?? "the priority"} is set.`
          : (res.message ?? "That did not save."),
        undoId: null,
      });
      return;
    }
    if (intent.kind === "sweep") {
      if (!operator) {
        setPhase({
          name: "logged",
          message: "Sweeps are operator gated. Krish can run one from Radar.",
          undoId: null,
        });
        return;
      }
      setPhase({ name: "thinking", label: "Sweeping the market" });
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      setPhase({
        name: "logged",
        message: res.ok ? "Sweep done. The radar is re-dealt." : "The sweep failed.",
        undoId: null,
      });
      router.refresh();
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] pb-4">
      <header className="flex items-center justify-between px-5 pt-4">
        <div className="eyebrow">Ask</div>
        {phase.name !== "idle" && (
          <button
            onClick={() => setPhase({ name: "idle" })}
            className="eyebrow underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-col items-center justify-center gap-4 overflow-hidden px-6">
        {phase.name === "idle" && (
          <>
            <HoldButton onDown={startRecording} onUp={stopRecording} listening={false} />
            <p className="text-center text-[15px] leading-snug text-ink2">
              Hold to talk. Ask anything about where things stand, or just say what you want to do.
            </p>
          </>
        )}

        {phase.name === "listening" && (
          <>
            <HoldButton onDown={() => {}} onUp={stopRecording} listening />
            <p className="text-center text-[15px] text-ink2">Listening. Let go when you are done.</p>
          </>
        )}

        {phase.name === "thinking" && (
          <p className="animate-pulse text-center text-[16px] text-ink2">
            {phase.label}.
          </p>
        )}

        {phase.name === "answer" && (
          <div className="flex max-h-full w-full flex-col gap-3 overflow-hidden rounded-xl border border-line bg-paper p-4">
            <div className="min-h-0 overflow-y-auto">
              <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">
                {phase.text.replace(/ ?\[[A-Z]\d+\]/g, "")}
                {!phase.done && <span className="animate-pulse">▍</span>}
              </p>
            </div>
            {phase.done && phase.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {phase.citations.map((c) =>
                  c.url ? (
                    <a key={c.ref} href={c.url} target="_blank" rel="noopener noreferrer">
                      <Chip active>{c.label.slice(0, 34)}</Chip>
                    </a>
                  ) : (
                    <Chip key={c.ref}>{c.label.slice(0, 34)}</Chip>
                  ),
                )}
              </div>
            )}
            {phase.done && phase.text.startsWith(FALLBACK) && operator && (
              <button
                onClick={() => void confirmCommand("", { kind: "sweep", topic: null })}
                className="self-start rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-medium text-bg"
              >
                Run the sweep
              </button>
            )}
          </div>
        )}

        {phase.name === "confirm" && (
          <div className="w-full rounded-xl border border-mint-bd bg-mint-wash p-4">
            <div className="eyebrow mb-1.5">
              {phase.intent.kind === "log_decision"
                ? "Note this down"
                : phase.intent.kind === "set_move"
                  ? `Set the move on ${phase.intent.priority_name ?? "a priority"}`
                  : "Take a fresh look at the market"}
            </div>
            <p className="text-[16px] leading-snug text-ink">
              {phase.intent.text ?? phase.intent.topic ?? phase.utterance}
            </p>
            {phase.intent.kind === "log_decision" && (
              <p className="mt-1 text-[13px] text-ink3">
                {SEATS[(phase.intent.owner_seat ?? 4) as SeatId].shortName} owns it
                {phase.intent.due_date ? ` · due ${phase.intent.due_date}` : ""}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void confirmCommand(phase.utterance, phase.intent)}
                className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg"
              >
                {phase.intent.kind === "log_decision" ? "Save it" : "Do it"}
              </button>
              <button
                onClick={() => setPhase({ name: "idle" })}
                className="rounded-full border border-line px-4 py-2 text-[14px] text-ink2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase.name === "logged" && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-[16px] text-ink">{phase.message}</p>
            {phase.undoId && (
              <button
                onClick={async () => {
                  await undoRecentDecision(phase.undoId!);
                  tick();
                  setPhase({ name: "idle" });
                  router.refresh();
                }}
                className="rounded-full border border-line px-4 py-1.5 text-[14px] text-ink2"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6">
        {phase.name === "idle" && (
          <div>
            <div className="eyebrow mb-1.5 text-center">You can also say</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {GRAMMAR.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink3"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = typed.trim();
            if (!q) return;
            setTyped("");
            setVoiceSession(false);
            void submit(q, false);
          }}
          className="flex gap-2"
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type it"
            className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            aria-label="Ask"
            className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-bg"
          >
            Ask
          </button>
        </form>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

function HoldButton({
  onDown,
  onUp,
  listening,
}: {
  onDown: () => void;
  onUp: () => void;
  listening: boolean;
}) {
  return (
    <button
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      aria-label="Hold to talk"
      className="flex h-44 w-44 touch-none items-center justify-center rounded-full border-2 select-none"
      style={{
        borderColor: listening ? "var(--mint-deep)" : "var(--ink)",
        background: listening ? "var(--mint-wash)" : "var(--paper)",
        boxShadow: listening
          ? "0 0 0 14px var(--mint-wash)"
          : "0 0 0 10px var(--mint-wash), 0 0 0 11px var(--mint-bd)",
      }}
    >
      <svg
        width="52"
        height="52"
        viewBox="0 0 24 24"
        fill="none"
        stroke={listening ? "var(--mint-deep)" : "var(--ink)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
        <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
      </svg>
    </button>
  );
}
