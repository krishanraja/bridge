import { redirect } from "next/navigation";
import { currentSeat } from "@/lib/auth";
import { SEATS, SEAT_IDS, allowlistedEmails, type SeatId } from "@/lib/seats";
import { useSeedData } from "@/lib/mode";
import { SignOutButton } from "@/components/rooms/SignOutButton";
import { ThreadsManager, type ThreadRow } from "@/components/rooms/ThreadsManager";
import { PushToggle } from "@/components/rooms/PushToggle";
import { LearnReview, type StagedProposal } from "@/components/rooms/LearnReview";
import { Chip } from "@/components/ui/Chip";

export const dynamic = "force-dynamic";

async function threadsData(
  seedMode: boolean,
): Promise<{ threads: ThreadRow[]; priorities: { id: string; name: string }[] }> {
  if (seedMode) {
    const { demoThreads, demoPriorities } = await import("@/lib/data/demo");
    const { priorities } = demoPriorities();
    const names = new Map(priorities.map((p) => [p.id, p.name]));
    return {
      threads: demoThreads().map((t) => ({
        id: t.id,
        name: t.name,
        org: t.org,
        seatOwner: t.seat_owner,
        status: t.status,
        nextTouchDate: t.next_touch_date,
        linkedPriorityName: t.linked_priority_id
          ? (names.get(t.linked_priority_id) ?? null)
          : null,
      })),
      priorities: priorities.map((p) => ({ id: p.id, name: p.name })),
    };
  }
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const [threadsQ, prioritiesQ] = await Promise.all([
    sb.from("threads").select("*").order("next_touch_date", { nullsFirst: false }),
    sb.from("priorities").select("id, name").is("retired_at", null),
  ]);
  const names = new Map((prioritiesQ.data ?? []).map((p) => [p.id, p.name]));
  return {
    threads: (threadsQ.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      org: t.org,
      seatOwner: t.seat_owner,
      status: t.status,
      nextTouchDate: t.next_touch_date,
      linkedPriorityName: t.linked_priority_id
        ? (names.get(t.linked_priority_id) ?? null)
        : null,
    })),
    priorities: (prioritiesQ.data ?? []).map((p) => ({ id: p.id, name: p.name })),
  };
}

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

async function operatorLearning(seedMode: boolean, seat: number) {
  if (seedMode || seat !== 4) return { proposal: null, metrics: null };
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { learnMetrics } = await import("@/lib/loop/metrics");
  const sb = await supabaseServer();
  const { data: staged } = await sb
    .from("learn_proposals")
    .select("id, proposal, week")
    .eq("status", "staged")
    .not("week", "like", "%:%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let proposal: StagedProposal | null = null;
  if (staged) {
    const p = staged.proposal as {
      summary: string;
      sourceWeights: { name: string; from: number; to: number }[];
      laneAppetite: unknown[];
      styleMemo: string | null;
    };
    proposal = {
      id: staged.id,
      summary: p.summary,
      sourceWeights: p.sourceWeights ?? [],
      laneCount: (p.laneAppetite ?? []).length,
      styleMemo: p.styleMemo ?? null,
    };
  }
  const metrics = await learnMetrics();
  return { proposal, metrics };
}

export default async function SettingsPage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const seedMode = useSeedData();
  const emails = allowlistedEmails();
  const seated = new Set(emails.values());
  const audit = await auditLog(seedMode);
  const { threads, priorities } = await threadsData(seedMode);
  const { proposal, metrics } = await operatorLearning(seedMode, seat);

  return (
    <div className="grid h-full min-h-0 auto-rows-min gap-2 overflow-hidden pb-3">
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
            : "Live. The pipeline, voice, the weekly loop, and the learning approvals all run against real data."}
        </p>
        <p className="mt-1.5 text-[10.5px] text-ink3">
          The market pipeline, voice, and the weekly loop are live. Learning
          lands next.
        </p>
      </section>

      {proposal && <LearnReview proposal={proposal} />}

      {metrics && (metrics.actRate != null || metrics.killRate != null) && (
        <section className="mx-5 rounded-xl border border-line bg-paper px-3.5 py-2.5">
          <div className="eyebrow mb-1.5">How it is learning</div>
          <div className="flex justify-between">
            <Metric label="Act rate" value={metrics.actRate != null ? `${metrics.actRate}%` : "-"} />
            <Metric label="Kill rate" value={metrics.killRate != null ? `${metrics.killRate}%` : "-"} />
            <Metric label="Briefs" value={metrics.briefCompletion != null ? `${metrics.briefCompletion}/4` : "-"} />
            <Metric label="Missed" value={metrics.missedStories != null ? String(metrics.missedStories) : "-"} />
          </div>
        </section>
      )}

      {!seedMode && <PushToggle />}

      <ThreadsManager
        threads={threads}
        priorities={priorities}
        isOperator={seat === 4}
      />

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="num-display text-[20px] font-medium">{value}</span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}

function SettingsClose() {
  return null;
}
