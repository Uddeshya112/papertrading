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
