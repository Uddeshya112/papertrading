# TradeGuru AI — Performance Report

## 1. Measured Micro-Benchmarks (Executed in Node)
* **O(1) Incremental Candlestick Update (`1,000` ticks):**
  * Before (Full 56-bar regeneration): **12.08–20.13 ms** per 1,000 ticks
  * After (`updateLatestCandle` O(1) patch): **1.05–1.13 ms** per 1,000 ticks (**11.5x–17.8x faster**, `~0.001 ms/tick`, well within `< 50 ms` chart interaction target)
* **Frontend Optimizations Verified in Code:** `next/dynamic` code splitting across 13 heavy feature views, `React.memo(ProCandlestickSvg)`, 15s server TTL cache + in-flight request deduplication in `/api/market/quotes`.

## 2. Unmeasured Browser/Network Targets (Pending Staging Deployment)
* **LCP (< 2.5s), INP (< 200ms), Route Transition (< 200ms), and Database `EXPLAIN ANALYZE` p95 (< 300ms):** **NOT TESTED** in sandbox (no headless browser Lighthouse run against deployed Next.js build or live Postgres). Must be measured on Vercel Preview + Supabase Staging before production launch.
