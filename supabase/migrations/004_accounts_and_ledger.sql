-- Migration 004: Virtual Trading Accounts, Optimistic-Locked Balances & Append-Only Double-Entry Ledger
-- Strict NUMERIC(18,4) monetary precision — ZERO floating-point money columns.

create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null default 'Standard ₹10L Virtual Account',
  challenge_id text not null default 'standard_10l',
  currency char(3) not null default 'INR',
  starting_capital numeric(18,4) not null default 1000000.0000 check (starting_capital > 0),
  reset_count integer not null default 0 check (reset_count >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_settings (
  account_id uuid primary key references public.trading_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  brokerage_plan text not null default 'ZERO_BROKERAGE' check (brokerage_plan in ('ZERO_BROKERAGE', 'FLAT_20')),
  simulate_slippage boolean not null default true,
  slippage_bps integer not null default 5 check (slippage_bps between 0 and 100),
  auto_refill_enabled boolean not null default true,
  auto_refill_threshold numeric(18,4) not null default 25000.0000 check (auto_refill_threshold >= 0),
  updated_at timestamptz not null default now()
);

-- Materialized current balance row updated ONLY atomically inside DB transactions with optimistic locking `version`
create table if not exists public.account_balances (
  account_id uuid primary key references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  available_balance numeric(18,4) not null default 1000000.0000,
  blocked_balance numeric(18,4) not null default 0.0000 check (blocked_balance >= 0),
  realized_pnl numeric(18,4) not null default 0.0000,
  currency char(3) not null default 'INR',
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

-- Append-Only Immutable Financial Ledger (Double-Entry Accounting)
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  transaction_id uuid not null,
  idempotency_key text not null,
  entry_type text not null check (
    entry_type in (
      'INITIAL_CAPITAL',
      'VIRTUAL_REFILL',
      'MARGIN_BLOCK',
      'MARGIN_RELEASE',
      'TRADE_DEBIT',
      'TRADE_CREDIT',
      'BROKERAGE_FEE',
      'STATUTORY_TAX',
      'REALIZED_PNL'
    )
  ),
  debit_amount numeric(18,4) not null default 0.0000 check (debit_amount >= 0),
  credit_amount numeric(18,4) not null default 0.0000 check (credit_amount >= 0),
  currency char(3) not null default 'INR',
  reference_type text not null,
  reference_id text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint chk_ledger_single_side check (
    (debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)
  ),
  constraint uq_ledger_idempotency unique (account_id, idempotency_key)
);
