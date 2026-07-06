-- Theme acceleration: how fast a theme is building. Computed within a single
-- themes run from the spread of its member signals' days (recent members vs
-- older members), so no snapshot history table is needed. A high value marks an
-- emerging trend the table should get ahead of. Written by the weekly loop
-- (service role); read by every seat.
-- Additive and backward compatible: existing rows default to 0.

alter table themes
  add column acceleration numeric not null default 0;
