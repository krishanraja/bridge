-- Per-decision receipts and sign-off. Moves "who's caught up" down to the
-- decision level: every seat can see who has viewed a decision, who concurred,
-- and who left feedback. Brief section: the table sees itself.

-- 1. Read receipts per decision reuse the receipts table. Relax the artifact
--    type check so a decision id can be the artifact.
alter table receipts drop constraint receipts_artifact_type_check;
alter table receipts add constraint receipts_artifact_type_check
  check (artifact_type in ('brief', 'pulse', 'decision'));

-- 2. Sign-off: each seat may take one position on a decision — concur, or
--    leave feedback (optionally with a note). One row per seat per decision.
create table decision_signoffs (
  id bigserial primary key,
  seat int not null references seats,
  decision_id uuid not null references decisions on delete cascade,
  stance text not null check (stance in ('concur', 'feedback')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seat, decision_id)
);

create index decision_signoffs_decision_idx on decision_signoffs (decision_id);

alter table decision_signoffs enable row level security;

-- Any seat reads the whole table's sign-off (visibility is the point).
create policy decision_signoffs_read on decision_signoffs for select to authenticated
  using (public.current_seat() is not null);
-- A seat may only write its own position.
create policy decision_signoffs_insert on decision_signoffs for insert to authenticated
  with check (seat = public.current_seat());
create policy decision_signoffs_update_own on decision_signoffs for update to authenticated
  using (seat = public.current_seat()) with check (seat = public.current_seat());

-- Realtime so a concur lands on every open table without a refresh.
alter publication supabase_realtime add table decision_signoffs;
