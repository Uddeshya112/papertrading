-- TradeGuru AI — Executable Multi-Tenant PostgreSQL RLS & Immutable Ledger Security Test
-- Run inside Supabase SQL Editor or `psql` after applying migrations 001 through 015.
-- Wrapped in BEGIN ... ROLLBACK so zero test records pollute production data!

begin;

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_acc_a uuid;
  v_visible_count integer;
  v_tamper_blocked boolean := false;
  v_reconcile record;
begin
  -- Setup test identities (requires postgres/service role in test transaction)
  insert into auth.users (id, email) values (v_user_a, 'usera@test.local'), (v_user_b, 'userb@test.local')
  on conflict (id) do nothing;

  insert into public.profiles (id, email, full_name, role)
  values (v_user_a, 'usera@test.local', 'User A', 'user'), (v_user_b, 'userb@test.local', 'User B', 'user')
  on conflict (id) do nothing;

  insert into public.trading_accounts (user_id, account_name, starting_capital)
  values (v_user_a, 'User A ₹10L Account', 1000000.0000)
  returning id into v_acc_a;

  insert into public.account_balances (account_id, user_id, available_balance)
  values (v_acc_a, v_user_a, 0.0000);

  -- Simulate Authenticated User A posting ₹10,00,000 initial capital via atomic ledger RPC
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  perform * from public.tg_post_ledger_entry(
    v_acc_a, gen_random_uuid(), 'INIT-A-001', 'INITIAL_CAPITAL', 0, 1000000.0000, 'ACCOUNT', v_acc_a::text, 'Initial ₹10L'
  );

  -- TEST 1: Idempotency — replaying same idempotency_key must NOT double-credit balance
  perform * from public.tg_post_ledger_entry(
    v_acc_a, gen_random_uuid(), 'INIT-A-001', 'INITIAL_CAPITAL', 0, 1000000.0000, 'ACCOUNT', v_acc_a::text, 'Duplicate replay'
  );

  select * into v_reconcile from public.tg_reconcile_account_balance(v_acc_a);
  if not v_reconcile.is_consistent or v_reconcile.materialized_balance <> 1000000.0000 then
    raise exception 'TEST FAILED: Balance reconciliation mismatch: %', v_reconcile;
  end if;

  -- TEST 2: Immutability — User A attempting to UPDATE ledger_entries must fail
  begin
    update public.ledger_entries set credit_amount = 9999999 where account_id = v_acc_a;
  exception when others then
    v_tamper_blocked := true;
  end;
  if not v_tamper_blocked then
    raise exception 'TEST FAILED: Ledger UPDATE was not blocked!';
  end if;

  -- TEST 3: Cross-Tenant Isolation — Switch to Authenticated User B and try reading User A accounts & ledger
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text, true);

  select count(*) into v_visible_count from public.trading_accounts where id = v_acc_a;
  if v_visible_count <> 0 then
    raise exception 'TEST FAILED: User B saw % rows of User A trading_accounts!', v_visible_count;
  end if;

  select count(*) into v_visible_count from public.ledger_entries where account_id = v_acc_a;
  if v_visible_count <> 0 then
    raise exception 'TEST FAILED: User B saw % rows of User A ledger_entries!', v_visible_count;
  end if;

  raise notice 'ALL LIVE POSTGRES RLS, IDEMPOTENCY, IMMUTABILITY & RECONCILIATION TESTS PASSED!';
end $$;

rollback;
