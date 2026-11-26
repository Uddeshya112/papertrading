# TradeGuru AI — Database Validation Report (`001`–`016`)

## 1. Migration Integrity (`001`–`016`)
* **Preservation:** `001_tradeguru_schema.sql` and `002_enterprise_hardening.sql` were never overwritten. Migrations `003` through `016` are strictly incremental.
* **Precision & Constraints:** Zero floating-point monetary columns across all 16 files; every monetary field uses `NUMERIC(18,4)`. `016` adds `chk_account_balances_non_negative` (`available_balance >= 0`).
* **Immutability:** `tg_block_mutation` (`015`) blocks `UPDATE`/`DELETE` on `ledger_entries`, `executions`, `order_events`, `audit_logs`, and `admin_actions`; `enforce_journal_financial_immutability` (`002`) protects historical trade execution fields.

## 2. Live Database Execution Status
* **Static SQL Validation:** **PASS** (verified by `run-security-db-tests.mjs` across all 16 files).
* **Live PostgreSQL `EXPLAIN ANALYZE` & Multi-User Execution:** **NOT TESTED** in sandbox (no local Postgres daemon). Run `supabase/tests/rls_and_ledger_security_test.sql` in Supabase SQL Editor after applying `001`–`016`.
