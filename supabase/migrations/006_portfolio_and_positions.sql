-- Migration 006: Portfolio Positions, Delivery Holdings & Daily Equity Snapshots

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  instrument_id text not null,
  symbol text not null,
  exchange text not null,
  segment text not null,
  side text not null check (side in ('BUY', 'SELL')),
  product text not null check (product in ('INTRADAY', 'NRML')),
  quantity numeric(18,4) not null check (quantity > 0),
  average_entry_price numeric(18,4) not null check (average_entry_price > 0),
  stop_loss_price numeric(18,4),
  target_price numeric(18,4),
  margin_blocked numeric(18,4) not null default 0 check (margin_blocked >= 0),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  instrument_id text not null,
  symbol text not null,
  exchange text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  average_cost numeric(18,4) not null check (average_cost > 0),
  updated_at timestamptz not null default now(),
  constraint uq_holdings_account_instrument unique (account_id, instrument_id)
);

-- Pre-aggregated daily equity curve snapshots (prevents full history scans on dashboard load)
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  snapshot_date date not null,
  cash_balance numeric(18,4) not null,
  blocked_margin numeric(18,4) not null,
  unrealized_pnl numeric(18,4) not null default 0,
  realized_pnl numeric(18,4) not null default 0,
  total_equity numeric(18,4) not null,
  created_at timestamptz not null default now(),
  constraint uq_snapshot_account_date unique (account_id, snapshot_date)
);
