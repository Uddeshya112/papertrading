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
