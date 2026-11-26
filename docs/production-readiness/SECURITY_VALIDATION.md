# TradeGuru AI — Security Validation Report

## 1. Confirmed & Fixed Vulnerabilities (Audit → Remediation)
1. **P0 — Unprotected `SECURITY DEFINER` RPCs (`015`):** Fixed in `016_security_audit_fixes.sql` via `REVOKE ALL ON FUNCTION ... FROM PUBLIC`, explicit `GRANT EXECUTE ... TO authenticated`, and `auth.uid()` ownership/role checks inside `tg_reconcile_account_balance` and `tg_append_audit_log`.
2. **P0 — Concurrent Audit Hash-Chain Fork (`015`):** Fixed in `016` using `pg_advisory_xact_lock(hashtext('public.audit_logs.hash_chain'))`.
3. **P0 — Negative Balance & Missing Row Guard (`004`/`015`):** Fixed in `016` via `chk_account_balances_non_negative` and `IF NOT FOUND` / `INSUFFICIENT_BALANCE` checks.
4. **P1 — 18 `FORCE RLS` Tables Without Policies (`014`) & `001` Missing `FORCE RLS`:** Fixed in `016` with explicit least-privilege policies for all 18 tables and `FORCE ROW LEVEL SECURITY` on all 5 tables in `001`.
5. **P2 — Admin MFA Assurance & Rate Limiting (`/api/admin/audit`):** Hardened with per-IP rate limiting (20 req/min) and live JWT `aal === 'aal2'` verification via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
6. **P2 — Public Telemetry Exposure (`/api/health`):** Restricted `memoryMb` and `upstreamErrors` behind `x-health-token` (`HEALTH_CHECK_SECRET`).
7. **P2 — Unconsumed Admin Endpoint:** Wired `MarketIntelAdminView` to call `GET /api/admin/audit` with the user's Supabase Bearer token.

## 2. Security Test Status
* **Automated Node Security Suite:** **9/9 PASS** (`run-security-db-tests.mjs`).
* **Live Multi-User RLS & MFA Penetration Test:** **NOT TESTED** in offline sandbox (requires live Supabase Auth + Postgres).
