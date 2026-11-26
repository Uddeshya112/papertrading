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
