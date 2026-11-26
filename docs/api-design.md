# TradeGuru AI — API Design & Contracts

## 1. Next.js BFF Endpoints

### `GET /api/market/quotes`
* **Purpose:** Fetches legally accessible public delayed NSE/BSE/Index quotes with 15-second in-memory cache, per-IP token-bucket rate limiting (30 req/min), and upstream circuit breaker (opens for 60s after 3 consecutive failures).
* **Response (`200 OK`):**
```json
{
  "ok": true,
  "cached": true,
  "latencyMs": 2,
  "source": "Yahoo Finance Public Feed (Delayed)",
  "circuitState": "CLOSED",
  "quotes": {
    "NSE:RELIANCE": {
      "instrumentId": "NSE:RELIANCE",
      "last": 1450.25,
      "prevClose": 1442.10,
      "change": 8.15,
      "changePercent": 0.57,
      "mode": "DELAYED",
      "asOf": "2026-11-26T03:50:00.000Z"
    }
  }
}
```
* **Error Codes:** `429 Too Many Requests` (rate limit exceeded with `Retry-After` header), `503 Service Unavailable` (upstream unavailable; client gracefully continues on simulated ticks).

### `GET /api/health`
* **Purpose:** Operational health & diagnostics endpoint for uptime monitors (Vercel/Render/UptimeRobot).
* **Response (`200 OK`):** Returns `status`, `version`, `uptimeSec`, `memoryMb`, `marketCache` (hit/miss ratio & circuit state), and `supabaseConfigured` boolean (never exposing keys).

## 2. Supabase REST / PostgREST Contracts (JWT + RLS)
* `UPSERT /rest/v1/tradeguru_accounts` — Account state sync (`onConflict: user_id`).
* `INSERT /rest/v1/tradeguru_journal_trades` — Idempotent closed trade persistence (`onConflict: id`).
* `INSERT /rest/v1/tradeguru_refill_history` — Append-only virtual capital refill audit (`ignoreDuplicates: true`).

## 3. Optional Java Backend (`nextrade-api`)
* `GET /api/v1/portfolio` — Auto-provisions ₹10,00,000 demo account.
* `POST /api/v1/portfolio/refill` — Safe refill preserving historical stats.
* `GET /api/v1/portfolio/refills` & `GET /api/v1/portfolio/audit-log` — Immutable ledgers.
