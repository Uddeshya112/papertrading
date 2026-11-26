-- TradeGuru AI — Migration 002: Enterprise Financial Immutability, Idempotency & Cursor Pagination

-- 1. Add idempotency keys to prevent duplicate writes during offline retries
alter table public.tradeguru_journal_trades
  add column if not exists idempotency_key text;

alter table public.tradeguru_refill_history
  add column if not exists idempotency_key text;

create unique index if not exists uq_tg_journal_user_idem
  on public.tradeguru_journal_trades (user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists uq_tg_refill_user_idem
  on public.tradeguru_refill_history (user_id, idempotency_key)
  where idempotency_key is not null;

-- 2. Composite keyset/cursor pagination indexes (O(log N) instead of slow OFFSET)
create index if not exists idx_tg_journal_cursor
  on public.tradeguru_journal_trades (user_id, closed_at desc, id desc);

create index if not exists idx_tg_refills_cursor
  on public.tradeguru_refill_history (user_id, created_at desc, id desc);

create index if not exists idx_tg_audit_cursor
  on public.tradeguru_audit_log (created_at desc, id desc);

-- 3. Numeric integrity CHECK constraints
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_tg_journal_positive_qty_price'
  ) then
    alter table public.tradeguru_journal_trades
      add constraint chk_tg_journal_positive_qty_price
      check (quantity > 0 and entry_price > 0 and exit_price > 0 and charges >= 0);
  end if;
end $$;

-- 4. Database-enforced Financial Immutability Trigger on tradeguru_journal_trades
-- Allows updating ONLY post-trade reflection and post_emotion; blocks tampering with financial fields!
create or replace function public.enforce_journal_financial_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.instrument_id is distinct from old.instrument_id
     or new.symbol is distinct from old.symbol
     or new.side is distinct from old.side
     or new.quantity is distinct from old.quantity
     or new.entry_price is distinct from old.entry_price
     or new.exit_price is distinct from old.exit_price
     or new.gross_pnl is distinct from old.gross_pnl
     or new.charges is distinct from old.charges
     or new.net_pnl is distinct from old.net_pnl
     or new.opened_at is distinct from old.opened_at
     or new.closed_at is distinct from old.closed_at then
    raise exception 'IMMUTABLE_FINANCIAL_RECORD: Historical trade execution fields cannot be modified.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tg_journal_immutable on public.tradeguru_journal_trades;
create trigger trg_tg_journal_immutable
  before update on public.tradeguru_journal_trades
  for each row execute function public.enforce_journal_financial_immutability();
