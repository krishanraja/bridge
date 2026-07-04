-- Themes: the team knowledge graph. Recent signals cluster by meaning into
-- themes — what the market is doing — and each theme carries an importance
-- (how much it matters, by score and by the table's reactions) and a consensus
-- (how much the four seats agree on it). This is where "what's happening in
-- market that we all consider important" and "what we don't agree on" live.
-- Written by the pipeline/weekly loop (service role); read by every seat.

create table themes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  lane int check (lane between 1 and 8),
  -- Embedding centroid stored as a plain array, so recomputation needs no
  -- pgvector round-tripping.
  centroid jsonb,
  importance numeric not null default 0,
  -- 0..1 agreement across seats; null when too few reactions to judge.
  consensus numeric,
  member_ids uuid[] not null default '{}',
  member_count int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table themes enable row level security;

create policy themes_read on themes for select to authenticated
  using (public.current_seat() is not null);

alter publication supabase_realtime add table themes;
