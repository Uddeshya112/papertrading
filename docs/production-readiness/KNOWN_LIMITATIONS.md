# TradeGuru AI — Known Limitations & External Dependencies

1. **Market Data Feed:** `/api/market/quotes` uses Yahoo Finance public endpoints, which are **DELAYED** (~15 minutes) and subject to upstream availability. Sub-second exchange-grade live ticks require authorized Indian broker credentials (Flattrade, Upstox, Dhan, or Kite) plugged into `BrokerWebSocketAdapter` (`src/lib/market-provider.ts`).
2. **Simulated Execution:** All order fills, partial fills, 10-level market depth, and Indian tax/charge estimates are **educational simulations**—never real exchange transactions.
3. **AI Trading Teacher:** Currently a deterministic, rule-based 16-mistake engine (100% free, zero external API cost). Conversational open-ended LLM tutoring requires adding a server-side Gemini/OpenAI API key.
4. **Java Backend (`nextrade-api`):** Retained as an optional standalone Spring Boot sandbox; **Supabase PostgreSQL** is the sole authoritative cloud source of truth for TradeGuru AI (`ADR-002`).
5. **Unverified Sandbox Checks:** `npm run build`, `tsc --noEmit`, live Postgres `EXPLAIN ANALYZE`, live multi-user RLS execution, and live backup restoration must be run in your staging environment with network/Supabase access.
