-- BRIDGE migration one: the full core schema, deny-by-default RLS, the seat
-- allowlist gate, and realtime on the multiplayer tables.

create extension if not exists vector;

-- The four seats. Emails are configuration, seeded from SEAT_ALLOWLIST.
create table seats (
  id int primary key,
  email text unique,
  name text not null,
  role text not null check (role in ('principal', 'operator')),
  lane_order int[]
);

create table sources (
  id serial primary key,
  name text not null,
  kind text not null,
  url text not null,
  lane int,
  tier int not null default 1,
  weight numeric not null default 1.0,
  active bool not null default true,
  created_at timestamptz not null default now()
);

create table assumptions (
  id uuid primary key default gen_random_uuid(),
  statement text not null,
  rationale text,
  sponsor_seat int references seats,
  confidence numeric not null default 60,
  status text not null default 'holding'
    check (status in ('holding', 'strengthening', 'weakening', 'flipped', 'retired')),
  kind text not null default 'assumption' check (kind in ('assumption', 'force')),
  history jsonb not null default '[]',
  illustrative bool not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  lane int not null check (lane between 1 and 8),
  headline text not null,
  for_amperity text,
  posture text,
  score numeric not null default 0,
  corroboration int not null default 1,
  cluster jsonb not null default '[]',
  embedding vector(1536),
  assumption_id uuid references assumptions,
  assumption_direction int check (assumption_direction in (-1, 0, 1)),
  illustrative bool not null default false,
  created_at timestamptz not null default now()
);
create index signals_day_idx on signals (day, score desc);

create table assumption_evidence (
  id bigserial primary key,
  assumption_id uuid not null references assumptions,
  signal_id uuid not null references signals,
  direction int not null check (direction in (-1, 1)),
  weight int not null default 1 check (weight in (1, 2, 3)),
  created_at timestamptz not null default now()
);

create table priorities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 60),
  sponsor_seat int not null references seats,
  state text not null default 'driving'
    check (state in ('driving', 'at_risk', 'blocked', 'won', 'retired')),
  confidence numeric,
  display_order int not null default 1,
  blocker text,
  blocker_owner_seat int references seats,
  illustrative bool not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

-- One move per priority per week is a constraint, not a convention.
create table moves (
  id uuid primary key default gen_random_uuid(),
  priority_id uuid not null references priorities,
  iso_week text not null,
  text text not null,
  owner_seat int not null references seats,
  state text not null default 'proposed'
    check (state in ('proposed', 'agreed', 'shipped', 'missed')),
  outcome_note text,
  created_at timestamptz not null default now(),
  unique (priority_id, iso_week)
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  owner_seat int not null references seats,
  due_date date,
  state text not null default 'open' check (state in ('open', 'done', 'dropped')),
  logged_by int not null references seats,
  logged_via text not null default 'typed' check (logged_via in ('voice', 'typed')),
  source_ref jsonb,
  transcript text,
  illustrative bool not null default false,
  created_at timestamptz not null default now()
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text not null,
  seat_owner int not null references seats,
  next_touch_date date,
  next_touch_note text,
  last_touch_date date,
  status text not null default 'advancing'
    check (status in ('advancing', 'stalled', 'dormant')),
  linked_priority_id uuid references priorities,
  created_at timestamptz not null default now()
);

create table pulses (
  id bigserial primary key,
  iso_week text not null,
  seat int not null references seats,
  priority_id uuid not null references priorities,
  confidence int not null check (confidence between 0 and 100),
  created_at timestamptz not null default now(),
  unique (iso_week, seat, priority_id)
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  kind text not null default 'morning' check (kind in ('morning', 'close')),
  script text not null,
  line_refs jsonb,
  audio_path text,
  released_at timestamptz,
  edited_by_operator bool not null default false,
  created_at timestamptz not null default now(),
  unique (day, kind)
);

create table events (
  id bigserial primary key,
  seat int references seats,
  type text not null,
  subject_type text,
  subject_id text,
  value jsonb,
  created_at timestamptz not null default now()
);

create table receipts (
  id bigserial primary key,
  seat int not null references seats,
  artifact_type text not null check (artifact_type in ('brief', 'pulse')),
  artifact_id text not null,
  seen_at timestamptz not null default now(),
  unique (seat, artifact_type, artifact_id)
);

create table push_subscriptions (
  id bigserial primary key,
  seat int not null references seats,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  seat int references seats,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table learn_proposals (
  id bigserial primary key,
  week text not null,
  proposal jsonb not null,
  status text not null default 'staged'
    check (status in ('staged', 'approved', 'adjusted', 'skipped')),
  decided_by int references seats,
  created_at timestamptz not null default now()
);

-- Who is asking: resolved from the JWT email against the seats table.
create or replace function public.current_seat()
returns int
language sql stable security definer
set search_path = public
as $$
  select id from public.seats
  where email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_operator()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seats
    where id = public.current_seat() and role = 'operator'
  )
$$;

-- The front door: only allowlisted seats may become auth users.
create or replace function public.enforce_seat_allowlist()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.seats
    where email is not null and lower(email) = lower(new.email)
  ) then
    raise exception 'signups are restricted';
  end if;
  return new;
end;
$$;

drop trigger if exists seat_allowlist on auth.users;
create trigger seat_allowlist
  before insert on auth.users
  for each row execute function public.enforce_seat_allowlist();

-- Deny by default: RLS on everything, read for seated users, writes per role.
alter table seats enable row level security;
alter table sources enable row level security;
alter table assumptions enable row level security;
alter table signals enable row level security;
alter table assumption_evidence enable row level security;
alter table priorities enable row level security;
alter table moves enable row level security;
alter table decisions enable row level security;
alter table threads enable row level security;
alter table pulses enable row level security;
alter table briefs enable row level security;
alter table events enable row level security;
alter table receipts enable row level security;
alter table push_subscriptions enable row level security;
alter table audit_log enable row level security;
alter table learn_proposals enable row level security;

-- Reads: the four seats are peers in visibility.
create policy seats_read on seats for select to authenticated
  using (public.current_seat() is not null);
create policy sources_read on sources for select to authenticated
  using (public.current_seat() is not null);
create policy assumptions_read on assumptions for select to authenticated
  using (public.current_seat() is not null);
create policy signals_read on signals for select to authenticated
  using (public.current_seat() is not null);
create policy evidence_read on assumption_evidence for select to authenticated
  using (public.current_seat() is not null);
create policy priorities_read on priorities for select to authenticated
  using (public.current_seat() is not null);
create policy moves_read on moves for select to authenticated
  using (public.current_seat() is not null);
create policy decisions_read on decisions for select to authenticated
  using (public.current_seat() is not null);
create policy threads_read on threads for select to authenticated
  using (public.current_seat() is not null);
create policy pulses_read on pulses for select to authenticated
  using (public.current_seat() is not null);
create policy briefs_read on briefs for select to authenticated
  using (public.current_seat() is not null and released_at is not null or public.is_operator());
create policy events_read on events for select to authenticated
  using (public.is_operator());
create policy receipts_read on receipts for select to authenticated
  using (public.current_seat() is not null);
create policy audit_read on audit_log for select to authenticated
  using (public.current_seat() is not null);
create policy learn_read on learn_proposals for select to authenticated
  using (public.is_operator());
create policy push_read_own on push_subscriptions for select to authenticated
  using (seat = public.current_seat());

-- Writes principals can make: their own events, pulses, receipts, decisions,
-- push subscriptions, move state changes, and thread status updates.
create policy events_insert on events for insert to authenticated
  with check (seat = public.current_seat());
create policy pulses_insert on pulses for insert to authenticated
  with check (seat = public.current_seat());
create policy pulses_update_own on pulses for update to authenticated
  using (seat = public.current_seat());
create policy receipts_insert on receipts for insert to authenticated
  with check (seat = public.current_seat());
create policy decisions_insert on decisions for insert to authenticated
  with check (logged_by = public.current_seat());
create policy decisions_update on decisions for update to authenticated
  using (owner_seat = public.current_seat() or public.is_operator());
create policy push_insert_own on push_subscriptions for insert to authenticated
  with check (seat = public.current_seat());
create policy push_delete_own on push_subscriptions for delete to authenticated
  using (seat = public.current_seat());
create policy moves_update on moves for update to authenticated
  using (public.current_seat() is not null);
create policy threads_update on threads for update to authenticated
  using (public.current_seat() is not null);

-- Operator curation powers. The audit log records the hand on the tiller.
create policy priorities_write on priorities for all to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy moves_write on moves for insert to authenticated
  with check (public.is_operator());
create policy moves_delete on moves for delete to authenticated
  using (public.is_operator());
create policy assumptions_write on assumptions for all to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy sources_write on sources for all to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy briefs_write on briefs for update to authenticated
  using (public.is_operator());
create policy threads_write on threads for insert to authenticated
  with check (public.is_operator());
create policy threads_delete on threads for delete to authenticated
  using (public.is_operator());
create policy decisions_delete on decisions for delete to authenticated
  using (public.is_operator());
create policy learn_write on learn_proposals for update to authenticated
  using (public.is_operator());
create policy audit_insert on audit_log for insert to authenticated
  with check (seat = public.current_seat());

-- Realtime on the multiplayer tables.
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table pulses;
alter publication supabase_realtime add table decisions;
