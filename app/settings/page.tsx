import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { SEATS, SEAT_IDS, allowlistedEmails, type SeatId } from "@/lib/seats";
import { useSeedData } from "@/lib/mode";
import { SignOutButton } from "@/components/rooms/SignOutButton";
import { Chip } from "@/components/ui/Chip";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: number;
  seat: SeatId | null;
  action: string;
  created_at: string;
}

async function auditLog(seedMode: boolean): Promise<AuditRow[]> {
  if (seedMode) return [];
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { data } = await sb
    .from("audit_log")
    .select("id, seat, action, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []) as AuditRow[];
}

export default async function SettingsPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const seedMode = useSeedData();
  const emails = allowlistedEmails();
  const seated = new Set(emails.values());
  const audit = await auditLog(seedMode);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_1fr_auto] gap-2 pb-3">
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

      <section className="mx-5 min-h-0 overflow-hidden rounded-xl border border-line bg-paper p-3.5">
        <div className="eyebrow mb-1.5">The audit trail</div>
        {audit.length === 0 ? (
          <p className="text-[11px] leading-snug text-ink3">
            Operator edits land here: brief changes, priority curation, source
            tuning, learning approvals. All four seats can see the hand on the
            tiller.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-[11px] text-ink2">
                  {a.action.replace(/_/g, " ")}
                  {a.seat ? ` · ${SEATS[a.seat].shortName}` : ""}
                </span>
                <span className="text-[10.5px] text-ink3">
                  {a.created_at.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mx-5 flex items-end">
        {!seedMode && <SignOutButton />}
      </div>
    </div>
  );
}
