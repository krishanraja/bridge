"use client";

/* The one radar control. A leader has exactly one thing to decide about a market
   item: is it not for them, worth knowing, or worth acting on? Three choices, one
   tap, no second system. Each choice teaches the deck (more or less like this) and
   "act on it" hands the item to the operator. The optional "why" lives after the
   choice, in the deck's confirmation, so the card itself stays a single clear ask. */

import { Icon, type IconName } from "@/components/ui/Icon";
import { selection, success, impact } from "@/lib/haptics";

export type Intent = "dismiss" | "know" | "act";

const CHOICES: {
  intent: Intent;
  label: string;
  icon: IconName;
  haptic: () => void;
}[] = [
  { intent: "dismiss", label: "Not for me", icon: "close", haptic: selection },
  { intent: "know", label: "Worth knowing", icon: "bookmark", haptic: success },
  { intent: "act", label: "Act on it", icon: "bolt", haptic: impact },
];

export function SignalVerdict({ onChoose }: { onChoose: (intent: Intent) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHOICES.map((c) => {
        const strong = c.intent === "act";
        const warm = c.intent === "know";
        return (
          <button
            key={c.intent}
            onClick={() => {
              c.haptic();
              onChoose(c.intent);
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-[var(--r-md)] border py-2.5"
            style={
              strong
                ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }
                : warm
                  ? {
                      background: "var(--mint-wash)",
                      borderColor: "var(--mint-bd)",
                      color: "var(--mint-deep)",
                    }
                  : { borderColor: "var(--line)", color: "var(--ink-3)" }
            }
          >
            <Icon name={c.icon} size={19} strokeWidth={1.8} />
            <span className="text-[12px] font-medium leading-none">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
