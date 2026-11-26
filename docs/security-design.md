# TradeGuru AI — Security & Financial Integrity Design

## 1. Threat Model & Implemented Controls
| Threat Vector | Control Implemented | Verification |
| :--- | :--- | :--- |
| **Unauthorized Data Access** | Supabase Auth PKCE + PostgreSQL Row-Level Security (`auth.uid() = user_id`) on all 5 tables. | Verified in `001_tradeguru_schema.sql` |
| **Silent Financial Tampering** | No `DELETE` RLS policies + `BEFORE UPDATE` PostgreSQL trigger rejecting changes to `entry_price`, `exit_price`, `quantity`, `gross_pnl`, `charges`, `net_pnl`, `closed_at`. | Enforced in `002_enterprise_hardening.sql` |
| **Clickjacking / MIME Sniffing / XSS** | HTTP Security Headers in `next.config.ts` (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security`), plus HTML entity escaping in all report generators. | Configured in `next.config.ts` & `report-center.ts` |
| **API Abuse / Upstream Exhaustion** | Per-IP Token-Bucket Rate Limiter (30 req/min) + 60s Circuit Breaker on `/api/market/quotes`. | Implemented in `api/market/quotes/route.ts` |
| **Secret Leakage** | Zero `SERVICE_ROLE`, `JWT_SECRET`, or private API keys in `nextrade-web/src`. Only public `NEXT_PUBLIC_SUPABASE_URL` and anon/publishable key are exposed by design. | Audited across all 37 TS/TSX files (0 hits) |
| **Duplicate Financial Writes** | Deterministic order/trade/refill IDs + `idempotency_key` unique constraints on Supabase journal and refill tables. | Enforced in `002_enterprise_hardening.sql` |

## 2. Backup & Recovery Strategy
* **Supabase Daily Automated Backups** + Point-in-Time Recovery (PITR) on production plans.
* **Client Offline Recovery:** `localStorage` + pending sync queue (`cloud-sync.ts`) ensures zero data loss if a user loses Wi-Fi mid-session; queued writes flush automatically on `window.online`.
