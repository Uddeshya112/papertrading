# TradeGuru AI — Security Verification & Evidence Report

## Honest Verification Scope
* **Verified in VM Sandbox (Executed via `node nextrade-web/tests/run-security-db-tests.mjs`):**
  - Static SQL verification across all 15 migrations (`001`–`015`): confirmed `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on all 39 multi-tenant tables, zero `FLOAT`/`DOUBLE PRECISION`/`REAL` monetary columns, `SET search_path = public, pg_temp` on every `SECURITY DEFINER` function, and `BEFORE UPDATE OR DELETE` immutability triggers on `ledger_entries`, `executions`, `order_events`, `audit_logs`, and `admin_actions`.
  - Executed Node automated tests for RBAC (`authorizeServerAction` blocking normal users and blocking admins without MFA), exact integer-paise double-entry ledger reconciliation (`inrToPaise`, `reconcileLedgerPaise`), `/api/admin/audit` Bearer JWT + 401/403 enforcement, zero frontend secret leaks, and HTML XSS escaping.
* **Requires Live Supabase PostgreSQL Execution (Not runnable inside offline VM without Postgres daemon):**
  - Execute `supabase/tests/rls_and_ledger_security_test.sql` inside your Supabase SQL Editor to verify live multi-user JWT isolation (`User A` vs. `User B`), live `tg_post_ledger_entry` idempotency, live trigger blocking, and backup restoration drill.

## 12-Point Security Acceptance Checklist Status
| # | Check | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | User A cannot read User B's trades/holdings/journal | SQL Policy Verified · Live DB Test Ready | `014_rls_policies.sql` + `rls_and_ledger_security_test.sql` |
| 2 | User cannot modify `user_id` or escalate `role` | SQL Policy Verified · Live DB Test Ready | `profiles_update_own_non_role` + `WITH CHECK (user_id = auth.uid())` |
| 3 | Unauthenticated requests blocked on private APIs | Verified in Code & Node Test | `/api/admin/audit/route.ts` returns `401` without Bearer JWT |
| 4 | Service-role credentials never reach browser | **Verified (0 hits)** | Automated scan across all 42 frontend files |
| 5 | Admin endpoints enforce server-side RBAC + MFA | **Verified (Executed)** | `rbac-security.ts` + `/api/admin/audit/route.ts` |
| 6 | Ledger entries cannot be modified/deleted | SQL Trigger Verified · Live DB Test Ready | `trg_ledger_immutable` in `015_database_functions.sql` |
| 7 | Duplicate orders/executions prevented | SQL Unique + RPC Verified | `uq_orders_client_idempotency`, `uq_executions_idempotency`, `uq_ledger_idempotency` |
| 8 | Balance & ledger consistency | **Verified (Paise Unit Test) + SQL RPC Ready** | `reconcileLedgerPaise` + `tg_reconcile_account_balance` |
| 9 | Backup restoration tested | **Pending Live Supabase Staging** | Runbook in `backup-recovery-strategy.md` |
| 10 | Sensitive data excluded from logs/errors | Verified in API Routes | `/api/health` & `/api/admin/audit` return sanitized status only |
| 11 | Offline sync uses idempotency keys | **Verified in Code** | `cloud-sync.ts` sends `idempotency_key` + `ignoreDuplicates: true` |
| 12 | Migrations preserve existing `001`/`002` data | **Verified** | `001` & `002` untouched; `003`–`015` use `CREATE TABLE IF NOT EXISTS` |
