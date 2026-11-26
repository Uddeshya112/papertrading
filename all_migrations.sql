-- TradeGuru AI — Production Supabase PostgreSQL Schema
-- Enforces Row-Level Security (RLS) and IMMUTABLE financial history (journal trades, refills, audit log).

create extension if not exists "pgcrypto";

-- 1. Virtual Trading Accounts (Default ₹10,00,000)
create table if not exists public.tradeguru_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_capital numeric(16,2) not null default 1000000.00,
  challenge_id text not null default 'standard_10l',
  available_cash numeric(16,2) not null default 1000000.00,
  brokerage_plan text not null default 'ZERO_BROKERAGE',
  simulate_slippage boolean not null default true,
  slippage_bps integer not null default 5,
  confirm_before_order boolean not null default false,
  auto_refill_enabled boolean not null default true,
  auto_refill_threshold numeric(16,2) not null default 25000.00,
  reset_count integer not null default 0,
  risk_limits jsonb not null default '{}'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  watchlist jsonb not null default '[]'::jsonb,
  completed_course_ids jsonb not null default '[]'::jsonb,
  quiz_scores jsonb not null default '{}'::jsonb,
  prerequisites jsonb not null default '{}'::jsonb,
  snapshot_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Immutable Closed Trade Journal (Never DELETE or alter historical prices/P&L)
create table if not exists public.tradeguru_journal_trades (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id text not null,
  symbol text not null,
  exchange text not null,
  segment text not null,
  side text not null check (side in ('BUY','SELL')),
  product text not null,
  quantity numeric(16,4) not null,
  entry_price numeric(16,4) not null,
  exit_price numeric(16,4) not null,
  planned_stop_loss numeric(16,4),
  planned_target numeric(16,4),
  gross_pnl numeric(16,2) not null,
  charges numeric(16,2) not null,
  net_pnl numeric(16,2) not null,
  exit_reason text not null,
  followed_stop_loss boolean not null default true,
  strategy text not null,
  emotion text not null,
  post_emotion text,
  confidence_level integer not null default 3,
  regime text not null,
  rationale text not null default '',
  reflection text not null default '',
  opened_at timestamptz not null,
  closed_at timestamptz not null default now()
);

-- 3. Immutable Virtual Capital Refill & Reset History
create table if not exists public.tradeguru_refill_history (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('AUTO','MANUAL','CHALLENGE_SWITCH')),
  reason text not null,
  balance_before numeric(16,2) not null,
  amount_added numeric(16,2) not null,
  balance_after numeric(16,2) not null,
  closed_positions_count integer not null default 0,
  cancelled_orders_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Trading Psychology Self-Awareness Logs
create table if not exists public.tradeguru_psychology_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fear_score integer not null check (fear_score between 1 and 5),
  greed_score integer not null check (greed_score between 1 and 5),
  stress_score integer not null check (stress_score between 1 and 5),
  patience_score integer not null check (patience_score between 1 and 5),
  daily_reflection text not null default '',
  created_at timestamptz not null default now()
);

-- 5. Immutable Admin & Account Audit Log
create table if not exists public.tradeguru_audit_log (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  actor text not null,
  action text not null,
  details text not null,
  created_at timestamptz not null default now()
);

-- Enable Row-Level Security
alter table public.tradeguru_accounts enable row level security;
alter table public.tradeguru_journal_trades enable row level security;
alter table public.tradeguru_refill_history enable row level security;
alter table public.tradeguru_psychology_logs enable row level security;
alter table public.tradeguru_audit_log enable row level security;

-- RLS Policies: Users can only read/write their own data
create policy "accounts_owner_select" on public.tradeguru_accounts
  for select using (auth.uid() = user_id);
create policy "accounts_owner_upsert" on public.tradeguru_accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_owner_update" on public.tradeguru_accounts
  for update using (auth.uid() = user_id);

-- Journal: Append-only + reflection update only (NO DELETE policy!)
create policy "journal_owner_select" on public.tradeguru_journal_trades
  for select using (auth.uid() = user_id);
create policy "journal_owner_insert" on public.tradeguru_journal_trades
  for insert with check (auth.uid() = user_id);
create policy "journal_owner_update_reflection" on public.tradeguru_journal_trades
  for update using (auth.uid() = user_id);

-- Refill History: Strictly Append-Only (NO UPDATE, NO DELETE!)
create policy "refills_owner_select" on public.tradeguru_refill_history
  for select using (auth.uid() = user_id);
create policy "refills_owner_insert" on public.tradeguru_refill_history
  for insert with check (auth.uid() = user_id);

-- Psychology Logs: Owner read & insert
create policy "psych_owner_select" on public.tradeguru_psychology_logs
  for select using (auth.uid() = user_id);
create policy "psych_owner_insert" on public.tradeguru_psychology_logs
  for insert with check (auth.uid() = user_id);

-- Audit Log: Strictly Append-Only (NO UPDATE, NO DELETE!)
create policy "audit_owner_select" on public.tradeguru_audit_log
  for select using (auth.uid() = user_id);
create policy "audit_owner_insert" on public.tradeguru_audit_log
  for insert with check (auth.uid() = user_id);

-- Indexes for fast analytics queries
create index if not exists idx_tg_journal_user_closed on public.tradeguru_journal_trades (user_id, closed_at desc);
create index if not exists idx_tg_refills_user_date on public.tradeguru_refill_history (user_id, created_at desc);
create index if not exists idx_tg_psych_user_date on public.tradeguru_psychology_logs (user_id, created_at desc);

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

-- Migration 003: Identity, Profiles, Preferences, Sessions & RBAC Roles
-- Non-destructive incremental migration preserving 001 and 002.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'user',
      'analyst',
      'support_admin',
      'security_admin',
      'super_admin',
      'auditor'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  country text not null default 'IN',
  role public.app_role not null default 'user',
  mfa_enabled boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'EN' check (language in ('EN', 'HI')),
  teacher_mode_enabled boolean not null default true,
  confirm_before_order boolean not null default false,
  default_timeframe text not null default '15m',
  chart_theme text not null default 'editorial-light',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  device_label text not null default 'Web Browser',
  ip_address inet,
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

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

-- Migration 005: Separated Orders, Order Lifecycle Events & Individual Executions (Fills)

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  client_order_id text not null,
  instrument_id text not null,
  symbol text not null,
  exchange text not null,
  segment text not null,
  side text not null check (side in ('BUY', 'SELL')),
  order_type text not null check (order_type in ('MARKET', 'LIMIT', 'AUTO-LIMIT', 'SL', 'SL-M', 'BRACKET', 'COVER')),
  product text not null check (product in ('INTRADAY', 'DELIVERY', 'NRML')),
  tif text not null default 'DAY' check (tif in ('DAY', 'GTC')),
  quantity numeric(18,4) not null check (quantity > 0),
  filled_quantity numeric(18,4) not null default 0 check (filled_quantity >= 0 and filled_quantity <= quantity),
  limit_price numeric(18,4) check (limit_price is null or limit_price > 0),
  trigger_price numeric(18,4) check (trigger_price is null or trigger_price > 0),
  stop_loss_price numeric(18,4) check (stop_loss_price is null or stop_loss_price > 0),
  target_price numeric(18,4) check (target_price is null or target_price > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED')),
  strategy_tag text not null default '',
  emotion_tag text not null default 'Disciplined',
  rationale text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_orders_client_idempotency unique (account_id, client_order_id)
);

-- Complete immutable lifecycle history of every order state transition
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (
    event_type in ('CREATED', 'ACCEPTED', 'MODIFIED', 'PARTIAL_FILL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED')
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Individual simulated fills (supports partial fills & multiple executions per order)
create table if not exists public.executions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null,
  fill_quantity numeric(18,4) not null check (fill_quantity > 0),
  fill_price numeric(18,4) not null check (fill_price > 0),
  slippage_amount numeric(18,4) not null default 0 check (slippage_amount >= 0),
  brokerage_fee numeric(18,4) not null default 0 check (brokerage_fee >= 0),
  statutory_charges numeric(18,4) not null default 0 check (statutory_charges >= 0),
  execution_mode text not null default 'SIMULATED' check (execution_mode in ('SIMULATED')),
  executed_at timestamptz not null default now(),
  constraint uq_executions_idempotency unique (account_id, idempotency_key)
);

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

-- Migration 007: Market Instruments, Delayed/Simulated Quotes, OHLCV Candles & Options Chain Snapshots

create table if not exists public.instruments (
  id text primary key,
  symbol text not null,
  name text not null,
  exchange text not null,
  segment text not null,
  sector text not null default 'General',
  currency char(3) not null default 'INR',
  lot_size integer not null default 1 check (lot_size >= 1),
  tick_size numeric(12,4) not null default 0.0500 check (tick_size > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_quotes (
  instrument_id text primary key references public.instruments(id) on delete cascade,
  last_price numeric(18,4) not null check (last_price > 0),
  bid_price numeric(18,4),
  ask_price numeric(18,4),
  prev_close numeric(18,4),
  volume bigint not null default 0,
  feed_mode text not null check (feed_mode in ('LIVE', 'DELAYED', 'SIMULATED')),
  source text not null,
  as_of timestamptz not null default now()
);

create table if not exists public.historical_candles (
  instrument_id text not null references public.instruments(id) on delete cascade,
  timeframe text not null check (timeframe in ('1m','3m','5m','15m','30m','1H','4H','1D','1W','1M')),
  bucket_time timestamptz not null,
  open_price numeric(18,4) not null,
  high_price numeric(18,4) not null,
  low_price numeric(18,4) not null,
  close_price numeric(18,4) not null,
  volume bigint not null default 0,
  primary key (instrument_id, timeframe, bucket_time)
);

create table if not exists public.options_contracts (
  id text primary key,
  underlying_symbol text not null,
  expiry_date date not null,
  strike_price numeric(18,4) not null,
  option_type text not null check (option_type in ('CE', 'PE')),
  lot_size integer not null check (lot_size >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.options_snapshots (
  contract_id text not null references public.options_contracts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  ltp numeric(18,4) not null,
  iv_pct numeric(8,4),
  delta numeric(8,4),
  gamma numeric(10,6),
  theta numeric(10,4),
  vega numeric(10,4),
  open_interest bigint not null default 0,
  volume bigint not null default 0,
  primary key (contract_id, captured_at)
);

-- Migration 008: Risk Management Profiles, Personal Limits & Risk Breach Events

create table if not exists public.risk_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  risk_tier text not null default 'CONSERVATIVE' check (risk_tier in ('CONSERVATIVE', 'MODERATE', 'ACTIVE')),
  capital_protection_score integer not null default 100 check (capital_protection_score between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.risk_limits (
  account_id uuid primary key references public.trading_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  max_risk_per_trade_pct numeric(6,2) not null default 2.00 check (max_risk_per_trade_pct > 0 and max_risk_per_trade_pct <= 20),
  max_daily_loss_amount numeric(18,4) not null default 30000.0000 check (max_daily_loss_amount > 0),
  max_drawdown_pct numeric(6,2) not null default 10.00 check (max_drawdown_pct > 0 and max_drawdown_pct <= 50),
  max_consecutive_losses integer not null default 3 check (max_consecutive_losses between 1 and 20),
  max_open_positions integer not null default 6 check (max_open_positions between 1 and 50),
  max_sector_exposure_pct numeric(6,2) not null default 35.00 check (max_sector_exposure_pct between 5 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  severity text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  rule_code text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Migration 009: 28-Course Bilingual Trading Academy & Learning Progress

create table if not exists public.courses (
  id text primary key,
  course_number integer not null unique,
  tier text not null check (tier in ('Beginner', 'Intermediate', 'Technical & Risk', 'Advanced')),
  title_en text not null,
  title_hi text not null,
  summary_en text not null,
  summary_hi text not null,
  prerequisite_ids text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  lesson_order integer not null,
  content_en text not null,
  content_hi text not null,
  chart_example text not null default '',
  created_at timestamptz not null default now(),
  constraint uq_lessons_course_order unique (course_id, lesson_order)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  question_en text not null,
  question_hi text not null,
  options_en jsonb not null,
  options_hi jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  explanation_en text not null,
  explanation_hi text not null
);

create table if not exists public.learning_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  best_quiz_score integer not null default 0 check (best_quiz_score between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- Migration 010: Normalized Trading Journal, Reflections, Strategies & Backtesting Runs

create table if not exists public.trade_journals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  execution_id uuid references public.executions(id) on delete set null,
  idempotency_key text not null,
  instrument_id text not null,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric(18,4) not null check (quantity > 0),
  entry_price numeric(18,4) not null check (entry_price > 0),
  exit_price numeric(18,4) not null check (exit_price > 0),
  planned_stop_loss numeric(18,4),
  planned_target numeric(18,4),
  gross_pnl numeric(18,4) not null,
  charges numeric(18,4) not null check (charges >= 0),
  net_pnl numeric(18,4) not null,
  followed_stop_loss boolean not null default true,
  strategy_name text not null,
  emotion_before text not null,
  emotion_after text,
  confidence_level integer not null default 3 check (confidence_level between 1 and 5),
  market_regime text not null,
  entry_reasoning text not null default '',
  opened_at timestamptz not null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint uq_trade_journals_idem unique (user_id, idempotency_key)
);

create table if not exists public.journal_tags (
  journal_id uuid not null references public.trade_journals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null,
  primary key (journal_id, tag)
);

create table if not exists public.journal_reflections (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.trade_journals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reflection_text text not null,
  lessons_learned text not null default '',
  updated_at timestamptz not null default now(),
  constraint uq_reflection_per_journal unique (journal_id)
);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  rule_type text not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strategy_id uuid references public.strategies(id) on delete set null,
  instrument_id text not null,
  timeframe text not null,
  starting_capital numeric(18,4) not null check (starting_capital > 0),
  net_pnl numeric(18,4) not null,
  win_rate numeric(6,2) not null,
  profit_factor numeric(10,4) not null,
  max_drawdown_pct numeric(6,2) not null,
  sharpe_ratio numeric(10,4) not null,
  metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.backtest_trades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.backtest_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_index integer not null,
  entry_price numeric(18,4) not null,
  exit_price numeric(18,4) not null,
  quantity numeric(18,4) not null,
  charges numeric(18,4) not null,
  net_pnl numeric(18,4) not null,
  exit_reason text not null
);

-- Migration 011: AI Trading Teacher, Weakness Profiles, Challenges, Achievements & Report Jobs

create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  period_type text not null check (period_type in ('DAILY', 'WEEKLY', 'MONTHLY', 'ON_DEMAND')),
  overall_score integer not null check (overall_score between 0 and 100),
  discipline_score integer not null check (discipline_score between 0 and 100),
  improvement_score integer not null check (improvement_score between 0 and 100),
  grade text not null,
  summary text not null,
  homework jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.detected_mistakes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.teacher_reviews(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  journal_id uuid references public.trade_journals(id) on delete set null,
  mistake_code text not null,
  severity text not null check (severity in ('CRITICAL', 'WARNING', 'COACHING')),
  title text not null,
  eight_point_analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.weakness_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  top_weaknesses jsonb not null default '[]'::jsonb,
  mistake_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id text primary key,
  title text not null,
  focus_area text not null,
  xp_reward integer not null check (xp_reward > 0),
  target_count integer not null check (target_count > 0)
);

create table if not exists public.challenge_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null,
  awarded_at timestamptz not null default now(),
  constraint uq_user_badge unique (user_id, badge_code)
);

create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_kind text not null,
  export_format text not null check (export_format in ('PDF', 'CSV', 'XLS', 'HTML')),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  date_from date,
  date_to date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.report_jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  sha256_checksum text not null,
  created_at timestamptz not null default now()
);

-- Migration 012: Notifications, Offline Sync Operations, Security Events & Hash-Chained Audit Logs

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key text,
  category text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  price_alerts boolean not null default true,
  order_executions boolean not null default true,
  risk_warnings boolean not null default true,
  teacher_feedback boolean not null default true,
  refill_notices boolean not null default true,
  email_digest_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  last_synced_at timestamptz not null default now(),
  constraint uq_sync_device unique (user_id, device_key)
);

create table if not exists public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.sync_devices(id) on delete set null,
  idempotency_key text not null,
  operation_type text not null,
  status text not null default 'APPLIED' check (status in ('PENDING', 'APPLIED', 'CONFLICT', 'REJECTED')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_sync_op_idem unique (user_id, idempotency_key)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  label text not null default 'Browser',
  trusted boolean not null default false,
  last_ip inet,
  last_seen_at timestamptz not null default now(),
  constraint uq_user_device_fp unique (user_id, device_fingerprint)
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip_address inet,
  user_agent text not null default '',
  outcome text not null check (outcome in ('SUCCESS', 'FAILED_PASSWORD', 'MFA_REQUIRED', 'LOCKED_OUT')),
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  admin_role public.app_role not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action_code text not null,
  justification text not null,
  mfa_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Tamper-evident hash-chained immutable audit log
create table if not exists public.audit_logs (
  seq bigserial primary key,
  id uuid not null default gen_random_uuid() unique,
  user_id uuid references public.profiles(id) on delete set null,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  details jsonb not null default '{}'::jsonb,
  prev_hash text not null default 'GENESIS',
  entry_hash text not null,
  created_at timestamptz not null default now()
);

-- Migration 013: Workload-Driven Composite, Partial & Full-Text Search Indexes

-- Orders & Executions
create index if not exists idx_orders_user_account_created
  on public.orders (user_id, account_id, created_at desc, id desc);

create index if not exists idx_orders_open_status
  on public.orders (account_id, status)
  where status in ('PENDING', 'PARTIALLY_FILLED');

create index if not exists idx_order_events_order_created
  on public.order_events (order_id, created_at asc);

create index if not exists idx_executions_order_executed
  on public.executions (order_id, executed_at asc);

create index if not exists idx_executions_account_executed
  on public.executions (account_id, executed_at desc);

-- Financial Ledger
create index if not exists idx_ledger_account_created
  on public.ledger_entries (account_id, created_at desc, id desc);

create index if not exists idx_ledger_tx_id
  on public.ledger_entries (transaction_id);

-- Portfolio & Journal
create index if not exists idx_positions_account_open
  on public.positions (account_id, opened_at desc);

create index if not exists idx_journals_user_created
  on public.trade_journals (user_id, closed_at desc, id desc);

create index if not exists idx_journals_user_strategy
  on public.trade_journals (user_id, strategy_name, closed_at desc);

-- Notifications (partial index for fast unread badge count)
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- Security & Audit
create index if not exists idx_security_events_user_created
  on public.security_events (user_id, created_at desc);

create index if not exists idx_login_history_user_created
  on public.login_history (user_id, created_at desc);

create index if not exists idx_audit_logs_created_seq
  on public.audit_logs (created_at desc, seq desc);

-- Full-text search on instruments & courses
create index if not exists idx_instruments_fts
  on public.instruments using gin (to_tsvector('english', symbol || ' ' || name || ' ' || sector));

create index if not exists idx_courses_fts
  on public.courses using gin (to_tsvector('english', title_en || ' ' || summary_en));

-- Migration 014: Strict Multi-Tenant Row-Level Security (ENABLE + FORCE RLS) & RBAC Policies
-- Default access is DENY. Every user-owned table isolates rows strictly by (SELECT auth.uid()).

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())),
    'user'::public.app_role
  );
$$;

-- Enable AND Force RLS on all multi-tenant tables
do $$
declare
  tbl text;
  user_tables text[] := array[
    'profiles',
    'user_preferences',
    'user_sessions',
    'trading_accounts',
    'account_settings',
    'account_balances',
    'ledger_entries',
    'orders',
    'order_events',
    'executions',
    'positions',
    'holdings',
    'portfolio_snapshots',
    'risk_profiles',
    'risk_limits',
    'risk_events',
    'learning_progress',
    'trade_journals',
    'journal_tags',
    'journal_reflections',
    'strategies',
    'backtest_runs',
    'backtest_trades',
    'teacher_reviews',
    'detected_mistakes',
    'weakness_profiles',
    'challenge_progress',
    'achievements',
    'report_jobs',
    'generated_reports',
    'notifications',
    'notification_preferences',
    'sync_devices',
    'sync_operations',
    'user_devices',
    'login_history',
    'security_events',
    'admin_actions',
    'audit_logs'
  ];
begin
  foreach tbl in array user_tables loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('alter table public.%I force row level security', tbl);
  end loop;
end $$;

-- Public read-only market & academy catalog tables (RLS enabled, authenticated SELECT)
alter table public.instruments enable row level security;
alter table public.market_quotes enable row level security;
alter table public.historical_candles enable row level security;
alter table public.options_contracts enable row level security;
alter table public.options_snapshots enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.quizzes enable row level security;
alter table public.challenges enable row level security;

create policy "catalog_instruments_read" on public.instruments for select to authenticated using (true);
create policy "catalog_quotes_read" on public.market_quotes for select to authenticated using (true);
create policy "catalog_candles_read" on public.historical_candles for select to authenticated using (true);
create policy "catalog_options_read" on public.options_contracts for select to authenticated using (true);
create policy "catalog_opt_snaps_read" on public.options_snapshots for select to authenticated using (true);
create policy "catalog_courses_read" on public.courses for select to authenticated using (is_published = true);
create policy "catalog_lessons_read" on public.lessons for select to authenticated using (true);
create policy "catalog_quizzes_read" on public.quizzes for select to authenticated using (true);
create policy "catalog_challenges_read" on public.challenges for select to authenticated using (true);

-- Identity: profiles (user can read/update own profile, CANNOT escalate own role!)
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role = 'user');
create policy "profiles_update_own_non_role" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select role from public.profiles where id = (select auth.uid())));

-- Immutable Financial Tables: SELECT own only (writes MUST go through SECURITY DEFINER transactional RPCs)
create policy "balances_select_own" on public.account_balances for select to authenticated
  using (user_id = (select auth.uid()));

create policy "ledger_select_own" on public.ledger_entries for select to authenticated
  using (user_id = (select auth.uid()));

create policy "executions_select_own" on public.executions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "order_events_select_own" on public.order_events for select to authenticated
  using (user_id = (select auth.uid()));

-- User-owned read/write tables (strictly scoped to auth.uid())
create policy "accounts_own_all" on public.trading_accounts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "account_settings_own_all" on public.account_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "orders_select_own" on public.orders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "orders_insert_own" on public.orders for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "positions_select_own" on public.positions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "holdings_select_own" on public.holdings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "snapshots_select_own" on public.portfolio_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

create policy "journals_select_own" on public.trade_journals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "journals_insert_own" on public.trade_journals for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "reflections_own_all" on public.journal_reflections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "strategies_own_all" on public.strategies for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "backtests_own_all" on public.backtest_runs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "risk_limits_own_all" on public.risk_limits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "learning_progress_own_all" on public.learning_progress for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications_own_select_update" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications_own_mark_read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "sync_ops_own_all" on public.sync_operations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Audit & Admin RBAC: Only security_admin, super_admin, and read-only auditor may read audit_logs
create policy "audit_logs_rbac_read" on public.audit_logs for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_app_role() in ('security_admin', 'super_admin', 'auditor')
  );

create policy "admin_actions_rbac_read" on public.admin_actions for select to authenticated
  using (public.current_app_role() in ('security_admin', 'super_admin', 'auditor'));

-- Migration 015: Atomic Transactional Financial Functions, Hash-Chained Audit & Immutability Triggers
-- Every SECURITY DEFINER function pins `search_path = public, pg_temp` to prevent search-path hijacking.

create extension if not exists "pgcrypto";

-- 1. Universal Immutability Trigger (Blocks UPDATE & DELETE on append-only financial/audit tables)
create or replace function public.tg_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABLE_LEDGER_VIOLATION: % on %.% is strictly prohibited.', tg_op, tg_table_schema, tg_table_name;
end;
$$;

drop trigger if exists trg_ledger_immutable on public.ledger_entries;
create trigger trg_ledger_immutable
  before update or delete on public.ledger_entries
  for each row execute function public.tg_block_mutation();

drop trigger if exists trg_executions_immutable on public.executions;
create trigger trg_executions_immutable
  before update or delete on public.executions
  for each row execute function public.tg_block_mutation();

drop trigger if exists trg_order_events_immutable on public.order_events;
create trigger trg_order_events_immutable
  before update or delete on public.order_events
  for each row execute function public.tg_block_mutation();

drop trigger if exists trg_audit_logs_immutable on public.audit_logs;
create trigger trg_audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.tg_block_mutation();

drop trigger if exists trg_admin_actions_immutable on public.admin_actions;
create trigger trg_admin_actions_immutable
  before update or delete on public.admin_actions
  for each row execute function public.tg_block_mutation();

-- 2. Hash-Chained Tamper-Evident Audit Log Writer
create or replace function public.tg_append_audit_log(
  p_user_id uuid,
  p_actor text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prev_hash text;
  v_entry_hash text;
  v_id uuid;
begin
  select coalesce(
    (select entry_hash from public.audit_logs order by seq desc limit 1),
    'GENESIS'
  ) into v_prev_hash;

  v_entry_hash := encode(
    digest(
      v_prev_hash || '|' || coalesce(p_user_id::text, '') || '|' || p_actor || '|' || p_action || '|' || p_resource_type || '|' || p_resource_id || '|' || p_details::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_logs (user_id, actor, action, resource_type, resource_id, details, prev_hash, entry_hash)
  values (p_user_id, p_actor, p_action, p_resource_type, p_resource_id, p_details, v_prev_hash, v_entry_hash)
  returning id into v_id;

  return v_id;
end;
$$;

-- 3. Atomic Ledger Posting + Optimistic-Locked Balance Update (Idempotent)
create or replace function public.tg_post_ledger_entry(
  p_account_id uuid,
  p_transaction_id uuid,
  p_idempotency_key text,
  p_entry_type text,
  p_debit_amount numeric(18,4),
  p_credit_amount numeric(18,4),
  p_reference_type text,
  p_reference_id text,
  p_notes text default ''
)
returns table (
  ledger_id uuid,
  new_available_balance numeric(18,4),
  new_version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_bal record;
  v_existing uuid;
  v_ledger_id uuid;
  v_delta numeric(18,4);
begin
  if v_caller is null then
    raise exception 'UNAUTHORIZED: Authentication required.';
  end if;

  select user_id into v_owner from public.trading_accounts where id = p_account_id;
  if v_owner is null or v_owner <> v_caller then
    raise exception 'FORBIDDEN: Account does not belong to authenticated user.';
  end if;

  -- Idempotency check: return existing balance if already processed
  select id into v_existing
  from public.ledger_entries
  where account_id = p_account_id and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    select available_balance, version into v_bal
    from public.account_balances where account_id = p_account_id;
    return query select v_existing, v_bal.available_balance, v_bal.version;
    return;
  end if;

  -- Lock balance row for atomic update
  select available_balance, blocked_balance, version into v_bal
  from public.account_balances
  where account_id = p_account_id
  for update;

  v_delta := p_credit_amount - p_debit_amount;

  insert into public.ledger_entries (
    account_id, user_id, transaction_id, idempotency_key, entry_type,
    debit_amount, credit_amount, reference_type, reference_id, notes
  ) values (
    p_account_id, v_owner, p_transaction_id, p_idempotency_key, p_entry_type,
    p_debit_amount, p_credit_amount, p_reference_type, p_reference_id, p_notes
  ) returning id into v_ledger_id;

  update public.account_balances
  set available_balance = available_balance + v_delta,
      version = version + 1,
      updated_at = now()
  where account_id = p_account_id and version = v_bal.version
  returning available_balance, version into v_bal.available_balance, v_bal.version;

  return query select v_ledger_id, v_bal.available_balance, v_bal.version;
end;
$$;

-- 4. Periodic Reconciliation Function (Ledger Sum vs. Materialized Account Balance)
create or replace function public.tg_reconcile_account_balance(p_account_id uuid)
returns table (
  ledger_net_sum numeric(18,4),
  materialized_balance numeric(18,4),
  discrepancy numeric(18,4),
  is_consistent boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ledger_sum as (
    select coalesce(sum(credit_amount - debit_amount), 0)::numeric(18,4) as total
    from public.ledger_entries
    where account_id = p_account_id
  ),
  bal as (
    select coalesce(available_balance, 0)::numeric(18,4) as avail
    from public.account_balances
    where account_id = p_account_id
  )
  select
    ledger_sum.total,
    bal.avail,
    (ledger_sum.total - bal.avail)::numeric(18,4),
    (ledger_sum.total = bal.avail)
  from ledger_sum, bal;
$$;

