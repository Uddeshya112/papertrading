# TradeGuru AI — Production Deployment Checklist

1. **Apply Database Migrations in Staging First:** Run `001_tradeguru_schema.sql` through `016_security_audit_fixes.sql` in strict numeric order in Supabase SQL Editor.
2. **Execute Live Database Security Test:** Run `supabase/tests/rls_and_ledger_security_test.sql` in Supabase SQL Editor and confirm `ALL LIVE POSTGRES RLS, IDEMPOTENCY, IMMUTABILITY & RECONCILIATION TESTS PASSED!`.
3. **Configure Environment Variables (Vercel):**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `NEXT_PUBLIC_SITE_URL` (production HTTPS origin)
   - `HEALTH_CHECK_SECRET` (random 32-byte secret for `/api/health` telemetry)
4. **Configure Supabase Auth:** Enable Email Confirmation, PKCE Redirect URLs (`/auth/callback`, `/auth/reset-password`), and TOTP MFA for all Admin accounts.
5. **Run Local / CI Build Verification:**
   ```bash
   cd nextrade-web
   npm install
   npm run lint
   npx tsc --noEmit
   npm run build
   node tests/run-enterprise-tests.mjs
   node tests/run-security-db-tests.mjs
   node tests/run-integration-tests.mjs
   ```
6. **Verify Live Endpoints:** Confirm `GET /api/health` returns `200 OK` (without leaking `memoryMb`), `GET /api/admin/audit` returns `401` unauthenticated, and Lighthouse meets LCP `< 2.5s` / INP `< 200ms`.
