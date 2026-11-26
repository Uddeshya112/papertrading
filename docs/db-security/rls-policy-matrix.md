# TradeGuru AI — PostgreSQL RLS Policy & RBAC Matrix

All 39 user-owned and security tables enforce **both** `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` (`014_rls_policies.sql`). Default policy is **DENY ALL**.

| Table Group | `SELECT` | `INSERT` | `UPDATE` | `DELETE` | Trigger / RPC Protection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `profiles` | Own (`id = auth.uid()`) | Own (`role = 'user'`) | Own (role escalation blocked) | Denied | Prevents self-promotion to admin |
| `ledger_entries`, `executions`, `order_events` | Own (`user_id = auth.uid()`) | Via `SECURITY DEFINER` RPC only | **Blocked** (RLS + Trigger) | **Blocked** (RLS + Trigger) | `tg_block_mutation` + `tg_post_ledger_entry` |
| `account_balances` | Own (`user_id = auth.uid()`) | Via `SECURITY DEFINER` RPC only | Via atomic RPC only | Denied | Optimistic lock `version` + `FOR UPDATE` |
| `trading_accounts`, `orders`, `trade_journals` | Own (`user_id = auth.uid()`) | Own (`user_id = auth.uid()`) | Restricted (`002` trigger protects financial cols) | Denied | Idempotency unique constraints |
| `journal_reflections`, `strategies`, `risk_limits`, `learning_progress`, `sync_operations` | Own | Own | Own | Own (where non-financial) | Strictly scoped to `(SELECT auth.uid())` |
| `audit_logs`, `admin_actions` | Own OR `security_admin` / `super_admin` / `auditor` | Via `tg_append_audit_log` | **Blocked** (Trigger) | **Blocked** (Trigger) | SHA-256 hash chain + mandatory Admin MFA on API |
| `instruments`, `market_quotes`, `courses`, `lessons`, `quizzes`, `challenges` | Authenticated read-only | Service/Admin only | Service/Admin only | Service/Admin only | Public educational catalog |
