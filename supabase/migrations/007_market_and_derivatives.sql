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
