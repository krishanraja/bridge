-- Reactions: the universal, attributed feedback signal. One lightweight tap
-- (thumbs up / down) plus optional reason tags, on any object in the app. This
-- is the raw material the app learns each leader's taste from, and the team's
-- shared sense of what matters. Polymorphic on subject so every surface reuses
-- one store; one position per seat per object (re-tapping updates it).

create table reactions (
  id bigserial primary key,
  seat int not null references seats,
  subject_type text not null
    check (subject_type in ('signal', 'decision', 'brief', 'move', 'assumption', 'theme')),
  subject_id text not null,
  sentiment int not null check (sentiment in (-1, 1)),
  reason_tags text[] not null default '{}',
  note text,
  -- Denormalized lane for signal reactions so per-lane appetite is a single
  -- grouped read, no join. Null for non-lane subjects.
  lane int check (lane between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seat, subject_type, subject_id)
);

create index reactions_subject_idx on reactions (subject_type, subject_id);
create index reactions_seat_idx on reactions (seat);

alter table reactions enable row level security;

-- Everyone at the table sees the table's reactions (consensus is the point).
create policy reactions_read on reactions for select to authenticated
  using (public.current_seat() is not null);
-- A seat only writes its own.
create policy reactions_insert on reactions for insert to authenticated
  with check (seat = public.current_seat());
create policy reactions_update_own on reactions for update to authenticated
  using (seat = public.current_seat()) with check (seat = public.current_seat());

alter publication supabase_realtime add table reactions;
