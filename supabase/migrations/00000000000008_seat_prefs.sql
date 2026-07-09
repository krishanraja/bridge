-- Seat prefs: how each leader likes to work and be reached, recorded once in a
-- short tap-only wizard. One row per seat. The structured fields feed the brief
-- composer (depth, format, order) and the agent's act versus ask decision; the
-- generated summary_text is the plain English chief of staff cheat sheet.
-- Nothing here is required; a half finished row still reads cleanly.

create table seat_prefs (
  seat int primary key references seats(id),
  reach_daily text,
  reach_urgent text,
  after_hours text,
  update_depth text,
  long_form text,
  order_pref text,
  morning_brief text,
  autonomy_default text,
  disagree text,
  visibility text default 'team',
  numbers text,
  frequency text,
  money text,
  speed text,
  feedback text,
  trust text,
  top_focus text,
  focus_set_on date,
  sharp_time text,
  autonomy_scheduling text,
  autonomy_messages text,
  autonomy_research text,
  summary_text text,
  completed_at timestamptz,
  updated_at timestamptz default now()
);

alter table seat_prefs enable row level security;

-- A seat always reads its own row. A row set to team visibility is readable by
-- the other seats, matching the master brief's mutual visibility default. A
-- private row is readable only by that seat and the operator. The anon role has
-- no policy at all, so it reads nothing.
create policy seat_prefs_read on seat_prefs for select to authenticated
  using (
    seat = public.current_seat()
    or public.is_operator()
    or visibility = 'team'
  );

-- A seat writes its own row. The operator may also write another seat's row,
-- for setup help; the application records that in the audit log.
create policy seat_prefs_insert on seat_prefs for insert to authenticated
  with check (seat = public.current_seat() or public.is_operator());
create policy seat_prefs_update on seat_prefs for update to authenticated
  using (seat = public.current_seat() or public.is_operator())
  with check (seat = public.current_seat() or public.is_operator());

alter publication supabase_realtime add table seat_prefs;
