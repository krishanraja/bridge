import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { SEATS, SEAT_IDS, allowlistedEmails } from "@/lib/seats";
import { useSeedData } from "@/lib/mode";
import { SignOutButton } from "@/components/rooms/SignOutButton";
import { Chip } from "@/components/ui/Chip";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const seedMode = useSeedData();
  const emails = allowlistedEmails();
  const seated = new Set(emails.values());

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] gap-2 pb-3">
      <header className="px-5 pt-4">
        <div className="eyebrow">Settings</div>
      </header>

      <section className="mx-5 rounded-xl border border-line bg-paper p-3.5">
        <div className="eyebrow mb-2">The four seats</div>
        <div className="flex flex-col gap-2">
          {SEAT_IDS.map((id) => (
            <div key={id} className="flex items-center justify-between">
              <div>
                <span className="text-[13px] font-medium text-ink">
                  {SEATS[id].name}
                </span>
                <span className="ml-2 text-[10.5px] text-ink3">
                  {SEATS[id].location}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Chip>{SEATS[id].role}</Chip>
                {!seedMode && !seated.has(id) && <Chip>No login yet</Chip>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-5 rounded-xl border border-line bg-paper p-3.5">
        <div className="eyebrow mb-1.5">This instrument</div>
        <p className="text-[12px] leading-relaxed text-ink2">
          {seedMode
            ? "Running on sample data. Every row is illustrative and marked so. Live mode starts when the database is connected and the sample comes out."
            : "Live. Notification times, lane muting, source tuning, and the audit trail arrive with the later gates."}
        </p>
        <p className="mt-1.5 text-[10.5px] text-ink3">
          Gate zero build. Operator curation, the pipeline, voice, the weekly
          loop, and learning land in order.
        </p>
      </section>

      <div className="mx-5 flex items-end">
        {!seedMode && <SignOutButton />}
      </div>
    </div>
  );
}
