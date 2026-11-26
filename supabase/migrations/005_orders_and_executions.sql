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
