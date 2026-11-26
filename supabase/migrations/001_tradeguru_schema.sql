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
