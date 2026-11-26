# TradeGuru AI — End-to-End (E2E) Test Report

## Honest Execution Summary
Because this sandbox has no internet access (`npm install` and Playwright browser binaries cannot be downloaded) and no live Supabase instance, **full browser E2E journeys (A–F) could not be executed against a running server here**. Instead, all underlying engine contracts, API validation rules, RBAC/MFA gates, and component integrations were verified via **executed Node automated tests**.

| User Journey | Automated Logic / Contract Test | Live Browser + DB E2E |
| :--- | :--- | :--- |
| **A. New User (Signup → Profile → ₹10L Account)** | **PASS** (Default ₹10,00,000 provisioning & `profiles` sync verified) | **NOT TESTED** (Requires live Supabase Auth) |
| **B. Trading (Order → Partial Fill → Ledger → Balance)** | **PASS** (`/api/trading/validate` & `paper-engine` verified) | **NOT TESTED** (Requires running Next.js) |
| **C. Portfolio (Positions → Holdings → Exit → Refill)** | **PASS** (Safe refill & integer-paise reconciliation verified) | **NOT TESTED** |
| **D. Learning (28 Courses → Quiz → Refresh Persistence)** | **PASS** (`learning_progress` sync + `localStorage` verified) | **NOT TESTED** |
| **E. Admin (JWT → AAL2 MFA → `/api/admin/audit`)** | **PASS** (401/403/AAL2 enforcement & frontend wiring verified) | **NOT TESTED** (Requires live TOTP MFA session) |
| **F. Security (User A vs User B Isolation)** | **PASS (Static RLS)** | **BLOCKED** (Requires live Supabase SQL run of `rls_and_ledger_security_test.sql`) |
