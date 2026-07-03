"use client";

/* Notifications opt-in. One tap subscribes this device; the ration lives on
   the server, so this only decides whether the seat hears the rationed few. */

import { useEffect, useState } from "react";

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function PushToggle() {
  const [state, setState] = useState<"unknown" | "off" | "on" | "unsupported">("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const keyRes = await fetch("/api/push/subscribe");
      const { key } = (await keyRes.json()) as { key: string | null };
      if (!key) {
        setState("unsupported");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      if (res.ok) setState("on");
    } finally {
      setBusy(false);
    }
  };

  if (state === "unsupported" || state === "unknown") return null;

  return (
    <section className="mx-5 flex items-center justify-between rounded-xl border border-line bg-paper px-3.5 py-2.5">
      <div>
        <div className="eyebrow">Notifications</div>
        <p className="text-[13px] text-ink3">
          {state === "on"
            ? "On. One morning read, the Monday pulse, the Friday close."
            : "Off. The rationed few only, never a stream."}
        </p>
      </div>
      {state === "off" && (
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-medium text-bg disabled:opacity-60"
        >
          {busy ? "Enabling" : "Turn on"}
        </button>
      )}
      {state === "on" && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--mint)", border: "1px solid var(--mint-deep)" }} />
      )}
    </section>
  );
}
