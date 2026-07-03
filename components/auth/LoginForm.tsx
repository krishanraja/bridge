"use client";

/* Email in, code back, seat resolved. The failure message is the success message:
   the door reveals nothing about who holds a seat. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const NEUTRAL = "If that address holds a seat, a code is on its way.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "checking">("email");
  const [note, setNote] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setNote(NEUTRAL);
    setStage("code");
    /* The allowlist is enforced in the database; a rejected address gets the
       same face as an accepted one. */
    await supabaseBrowser()
      .auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } })
      .catch(() => {});
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setStage("checking");
    const { error } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setNote("That code did not open the door.");
      setStage("code");
      return;
    }
    router.replace("/today");
    router.refresh();
  };

  return (
    <div className="w-full max-w-[360px]">
      {stage === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-line bg-paper px-5 py-4 text-[16px] text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="rounded-full bg-ink py-4 text-[15px] font-medium text-bg"
          >
            Send the code
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Six digits"
            className="num-display w-full rounded-2xl border border-line bg-paper px-5 py-4 text-center text-[22px] tracking-[0.3em] text-ink outline-none focus:border-ink"
            disabled={stage === "checking"}
          />
          <button
            type="submit"
            disabled={stage === "checking"}
            className="rounded-full bg-ink py-4 text-[15px] font-medium text-bg disabled:opacity-60"
          >
            {stage === "checking" ? "Checking" : "Open"}
          </button>
          <button
            type="button"
            className="mt-1 text-[12px] text-ink3 underline underline-offset-2"
            onClick={() => {
              setStage("email");
              setCode("");
              setNote(null);
            }}
          >
            Different address
          </button>
        </form>
      )}
      {note && (
        <p className="mt-3 text-center text-[13px] leading-snug text-ink2">
          {note}
        </p>
      )}
    </div>
  );
}
