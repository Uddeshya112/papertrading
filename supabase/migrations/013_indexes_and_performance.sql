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
