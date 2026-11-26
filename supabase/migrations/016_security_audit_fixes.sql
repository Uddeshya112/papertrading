-- Migration 016: Production Security Audit Fixes & High-Concurrency Hardening
-- Fixes all P0/P1 findings:
--   1. REVOKE PUBLIC/anon EXECUTE on all SECURITY DEFINER functions; GRANT strictly to authenticated/service_role.
--   2. Per-account transactional advisory lock (pg_advisory_xact_lock) + negative balance guard + version conflict check.
--   3. Strict auth.uid() ownership enforcement in tg_reconcile_account_balance and tg_append_audit_log.
--   4. Complete RLS policies for all 18 previously unpolicied multi-tenant tables (all 39 tables covered).
--   5. High-concurrency hot-path composite indexes for orders, ledger, and journal queries.

-- ============================================================================
-- 1. HARDEN tg_append_audit_log (Caller Ownership / Admin Check)
-- ============================================================================
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
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
  v_prev_hash text;
  v_entry_hash text;
  v_id uuid;
begin
  -- Allow service_role (v_caller is null when invoked via service key) or authenticated owner/admin
  if v_caller is not null and p_user_id is not null and p_user_id <> v_caller then
    select exists(
      select 1 from public.profiles
      where id = v_caller and role in ('admin', 'super_admin', 'compliance_auditor') and is_suspended = false
    ) into v_is_admin;
    if not v_is_admin then
      raise exception 'FORBIDDEN: Cannot write audit log entries for another user.';
    end if;
  end if;

  -- Serialize hash-chain head read/write under concurrent load
  perform pg_advisory_xact_lock(hashtext('tg_audit_log_chain'));

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

-- ============================================================================
-- 2. HARDEN tg_post_ledger_entry (Advisory Lock + Negative Balance Guard + Version Guard)
-- ============================================================================
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
  v_next_balance numeric(18,4);
begin
  if v_caller is null then
    raise exception 'UNAUTHORIZED: Authentication required.';
  end if;

  if p_debit_amount < 0 or p_credit_amount < 0 then
    raise exception 'INVALID_AMOUNT: Debit and credit amounts must be non-negative.';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'INVALID_IDEMPOTENCY_KEY: Non-empty idempotency key is required.';
  end if;

  -- Serialize all concurrent balance mutations for this account
  perform pg_advisory_xact_lock(hashtext(p_account_id::text));

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

  -- Row-level lock on account balance
  select available_balance, blocked_balance, version into v_bal
  from public.account_balances
  where account_id = p_account_id
  for update;

  if not found then
    raise exception 'ACCOUNT_BALANCE_NOT_FOUND: Missing balance record for account.';
  end if;

  v_delta := p_credit_amount - p_debit_amount;
  v_next_balance := v_bal.available_balance + v_delta;

  -- Negative balance guard
  if v_next_balance < 0 then
    raise exception 'INSUFFICIENT_FUNDS: Posting would result in negative virtual balance (%).', v_next_balance;
  end if;

  insert into public.ledger_entries (
    account_id, user_id, transaction_id, idempotency_key, entry_type,
    debit_amount, credit_amount, reference_type, reference_id, notes
  ) values (
    p_account_id, v_owner, p_transaction_id, p_idempotency_key, p_entry_type,
    p_debit_amount, p_credit_amount, p_reference_type, p_reference_id, p_notes
  ) returning id into v_ledger_id;

  update public.account_balances
  set available_balance = v_next_balance,
      version = version + 1,
      updated_at = now()
  where account_id = p_account_id and version = v_bal.version
  returning available_balance, version into v_bal.available_balance, v_bal.version;

  if not found then
    raise exception 'CONCURRENCY_CONFLICT: Account balance version changed during update.';
  end if;

  return query select v_ledger_id, v_bal.available_balance, v_bal.version;
end;
$$;

-- ============================================================================
-- 3. HARDEN tg_reconcile_account_balance (Strict Ownership / Auditor Check)
-- ============================================================================
create or replace function public.tg_reconcile_account_balance(p_account_id uuid)
returns table (
  ledger_net_sum numeric(18,4),
  materialized_balance numeric(18,4),
  discrepancy numeric(18,4),
  is_consistent boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_is_auditor boolean := false;
begin
  if v_caller is null then
    raise exception 'UNAUTHORIZED: Authentication required.';
  end if;

  select user_id into v_owner from public.trading_accounts where id = p_account_id;
  if v_owner is null then
    raise exception 'NOT_FOUND: Trading account not found.';
  end if;

  if v_owner <> v_caller then
    select exists(
      select 1 from public.profiles
      where id = v_caller and role in ('admin', 'super_admin', 'compliance_auditor') and is_suspended = false
    ) into v_is_auditor;
    if not v_is_auditor then
      raise exception 'FORBIDDEN: Cannot reconcile another user''s trading account.';
    end if;
  end if;

  return query
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
end;
$$;

-- ============================================================================
-- 4. REVOKE PUBLIC / ANON EXECUTE ON ALL SECURITY DEFINER FUNCTIONS
-- ============================================================================
revoke all on function public.tg_append_audit_log(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.tg_append_audit_log(uuid, text, text, text, text, jsonb) to authenticated, service_role;

revoke all on function public.tg_post_ledger_entry(uuid, uuid, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.tg_post_ledger_entry(uuid, uuid, text, text, numeric, numeric, text, text, text) to authenticated, service_role;

revoke all on function public.tg_reconcile_account_balance(uuid) from public, anon;
grant execute on function public.tg_reconcile_account_balance(uuid) to authenticated, service_role;

-- ============================================================================
-- 5. COMPLETE RLS POLICIES FOR ALL 18 REMAINING MULTI-TENANT TABLES
-- ============================================================================
do $$
declare
  own_all_tables text[] := array[
    'user_preferences',
    'risk_profiles',
    'journal_tags',
    'backtest_trades',
    'teacher_reviews',
    'detected_mistakes',
    'weakness_profiles',
    'challenge_progress',
    'achievements',
    'report_jobs',
    'generated_reports',
    'notification_preferences',
    'sync_devices',
    'user_devices'
  ];
  own_read_insert_tables text[] := array[
    'user_sessions',
    'risk_events',
    'login_history',
    'security_events'
  ];
  tbl text;
begin
  foreach tbl in array own_all_tables loop
    execute format('drop policy if exists %I on public.%I', tbl || '_own_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl || '_own_all', tbl
    );
  end loop;

  foreach tbl in array own_read_insert_tables loop
    execute format('drop policy if exists %I on public.%I', tbl || '_own_select', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      tbl || '_own_select', tbl
    );
    execute format('drop policy if exists %I on public.%I', tbl || '_own_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      tbl || '_own_insert', tbl
    );
  end loop;
end $$;

-- ============================================================================
-- 6. HIGH-CONCURRENCY HOT-PATH INDEXES
-- ============================================================================
create index if not exists idx_orders_acct_status_created
  on public.orders (account_id, status, created_at desc);

create index if not exists idx_ledger_acct_created
  on public.ledger_entries (account_id, created_at desc);

create index if not exists idx_tradeguru_journal_user_closed
  on public.tradeguru_journal_trades (user_id, closed_at desc);
