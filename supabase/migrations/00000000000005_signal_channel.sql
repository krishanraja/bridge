-- Signal channel: two kinds of signal share one table. 'act' signals are the
-- scarce daily deck (twelve cards, event-driven). 'shift' signals are the
-- slow-moving structural reads that never compete for a deck slot; they are
-- written only to accrete evidence onto a house Watch item (a 'force' belief)
-- and to feed the themes graph. Every deck-facing reader filters channel='act';
-- the ledger evidence join and the themes builder read both.
-- Additive and backward compatible: existing rows default to 'act'.

alter table signals
  add column channel text not null default 'act'
  check (channel in ('act', 'shift'));

-- The deck reads the freshest act-signals for a day, ordered by score.
create index if not exists signals_day_channel_score_idx
  on signals (day, channel, score desc);
