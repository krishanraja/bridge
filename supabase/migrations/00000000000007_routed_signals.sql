-- Routed signals: the operator's inbox. When a principal taps "Act on it" on a
-- radar signal, the item is handed to the operator (seat 4) to turn into this
-- week's move or a logged decision. We snapshot the headline/posture/lane so the
-- routed item survives the daily signal churn (signals are regenerated). One row
-- per act; the operator resolves each to converted or dismissed.

create table routed_signals (
  id uuid primary key default gen_random_uuid(),
  -- The originating signal id, kept as text since signals rotate daily and we do
  -- not want a dangling FK once the source signal is replaced.
  signal_id text not null,
  from_seat int not null references seats,
  headline text not null,
  posture text,
  lane int check (lane between 1 and 8),
  -- Optional "why" the leader added after acting.
  note text,
  status text not null default 'open' check (status in ('open', 'converted', 'dismissed')),
  handled_by int references seats,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index routed_signals_status_idx on routed_signals (status);
create index routed_signals_from_idx on routed_signals (from_seat);

alter table routed_signals enable row level security;

-- The operator sees the whole inbox; a principal sees the items they routed.
create policy routed_signals_read on routed_signals for select to authenticated
  using (public.is_operator() or from_seat = public.current_seat());
-- A seat routes on its own behalf only.
create policy routed_signals_insert on routed_signals for insert to authenticated
  with check (from_seat = public.current_seat());
-- Only the operator resolves an item (converted / dismissed).
create policy routed_signals_update_operator on routed_signals for update to authenticated
  using (public.is_operator()) with check (public.is_operator());

alter publication supabase_realtime add table routed_signals;
