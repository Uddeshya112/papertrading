# TradeGuru AI — Architecture Decision Records (ADRs)

## ADR-001: Modular Monolith over Distributed Microservices
* **Decision:** Keep TradeGuru AI as a Next.js 16 Modular Monolith + Supabase PostgreSQL rather than splitting into separate microservices.
* **Rationale:** Eliminates distributed latency, cross-service schema drift, and cloud hosting bills (preserving 100% Free Forever operation) while maintaining strict internal module boundaries (`lib/`, `components/`, `app/api/`).

## ADR-002: Single Source of Truth (Supabase PostgreSQL vs. Java `PortfolioController`)
* **Decision:** Designate **Supabase PostgreSQL** (`tradeguru_accounts`, `tradeguru_journal_trades`, `tradeguru_refill_history`) as the sole authoritative cloud source of truth for user trading state, with `localStorage` as an offline-first cache.
* **Rationale:** Running an in-memory `ConcurrentHashMap` in Java `PortfolioController` alongside Supabase would create conflicting balances across restarts. The Java Spring Boot repository remains an optional standalone institutional matching-engine sandbox.

## ADR-003: Zero Unnecessary Third-Party Dependencies (State & Caching)
* **Decision:** Do not add Redux, Zustand, TanStack Query, or Redis in the current release; rely on pure reducers, `next/dynamic` code splitting, `React.memo`, incremental O(1) candle updates, and 15-second in-memory API TTL caching.
* **Rationale:** Keeps bundle size small and eliminates paid Redis hosting costs while meeting sub-50ms chart and sub-300ms API latency targets.

## ADR-004: Database-Enforced Financial Immutability
* **Decision:** Enforce immutability of closed trades and refill records at the PostgreSQL trigger & RLS level (`002_enterprise_hardening.sql`), not just in frontend UI code.
* **Rationale:** Prevents accidental or malicious modification of historical financial records even via direct API calls.
