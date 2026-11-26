# TradeGuru AI — Frontend-to-Backend-to-Database Integration Matrix

| Frontend Feature / Page | Backend API / Service | Database Table(s) / Storage | Auth & Ownership | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Auth (Signup/Login/Reset)** | Supabase Auth PKCE (`supabase.ts`, `/auth/callback`) | `auth.users`, `profiles` (`cloud-sync.ts`) | PKCE + Email Confirm | **PARTIALLY VERIFIED** (Code verified; live email flow pending) |
| **Dashboard & Overview KPIs** | `analytics.ts`, `teacher-coach.ts`, TradingView | `tradeguru_accounts`, `localStorage` | Owner RLS | **PARTIALLY VERIFIED** |
| **Pro Terminal & Order Ticket** | `paper-engine.ts`, `POST /api/trading/validate` | `tradeguru_accounts`, `orders`/`executions` (`005`) | Strict payload validation | **PASS (Code & Tests)** |
| **Market Watch & Delayed Quotes** | `GET /api/market/quotes` (15s TTL + Circuit Breaker) | In-memory server cache (`market-provider.ts`) | Public delayed (`30 req/min`) | **PARTIALLY VERIFIED** |
| **Portfolio, Positions, Holdings & ₹10L Refill** | `performSafeAccountRefill`, `cloud-sync.ts` | `tradeguru_accounts`, `tradeguru_refill_history` | Owner RLS + Append-only | **PARTIALLY VERIFIED** |
| **Options Chain, Baskets & Screener** | `options-chain.ts`, `basket-orders-view.tsx`, `screener-view.tsx` | Client state + `tradeguru_accounts` snapshot | Owner RLS | **PARTIALLY VERIFIED** |
| **Risk Center & Backtesting Lab** | `indian-charges.ts`, `backtest-engine.ts` | `tradeguru_accounts`, `risk_limits` (`008`), `backtest_runs` (`010`) | Owner RLS | **PARTIALLY VERIFIED** |
| **Trading Journal & 12 Reports** | `report-center.ts` (PDF/CSV/Excel) | `tradeguru_journal_trades` (Immutable trigger `002`) | Owner RLS + `BEFORE UPDATE` trigger | **PARTIALLY VERIFIED** |
| **28-Course Academy & Challenges** | `academy-courses.ts`, `cloud-sync.ts` | `learning_progress` (`009`), `tradeguru_accounts` | Owner RLS | **PARTIALLY VERIFIED** |
| **Admin Console & Audit Logs** | `GET /api/admin/audit` (wired in `MarketIntelAdminView`) | `profiles`, `audit_logs` (`012`/`016`) | Bearer JWT + RBAC + `aal2` MFA | **PASS (Code & Tests) / Live MFA Pending** |
| **System Health Diagnostics** | `GET /api/health` | Process telemetry (`x-health-token` gated) | Public minimal / Secret full | **PASS (Code & Tests)** |
