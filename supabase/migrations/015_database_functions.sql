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
