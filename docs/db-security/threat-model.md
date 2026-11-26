# TradeGuru AI — STRIDE Threat Model

| Category | Concrete Threat | Control Implemented |
| :--- | :--- | :--- |
| **Spoofing** | Attacker passes forged `user_id` in API/PostgREST payload. | RLS enforces `(SELECT auth.uid())`; `/api/admin/audit` verifies Supabase Bearer JWT server-side and ignores client-supplied IDs. |
| **Tampering** | User edits closed trade P&L, ledger entry, or audit log. | `tg_block_mutation` trigger on `ledger_entries`, `executions`, `order_events`, `audit_logs`, `admin_actions`; `enforce_journal_financial_immutability` on `tradeguru_journal_trades`; SHA-256 hash chain on `audit_logs`. |
| **Repudiation** | Admin or trader denies performing a refill or config change. | Immutable hash-chained `audit_logs` + `admin_actions` with timestamp, actor, role, justification, and `mfa_verified`. |
| **Information Disclosure** | Cross-tenant read of another user's portfolio/journal, or secret leak in client bundle. | `ENABLE + FORCE ROW LEVEL SECURITY` on 39 tables; zero service-role keys in `nextrade-web/src`; HSTS + `X-Frame-Options` + `nosniff`. |
| **Denial of Service** | Flooding `/api/market/quotes` to exhaust upstream Yahoo Finance quota. | Per-IP token-bucket rate limiter (30 req/min, HTTP 429) + in-flight request deduplication + 60s circuit breaker. |
| **Elevation of Privilege** | Normal user updates `profiles.role` to `super_admin` or calls admin API without MFA. | `profiles_update_own_non_role` RLS policy blocks role self-modification; `authorizeServerAction` mandates RBAC permission + `mfaVerified = true` for admin roles; all `SECURITY DEFINER` functions pin `search_path = public, pg_temp`. |
