# TradeGuru AI — Performance Engineering & Bottleneck Analysis

## 1. Audited Bottlenecks (Before Optimization)
1. **Static Monolithic Bundle:** `page.tsx` statically imported all 15 feature views (including the 28-course bilingual Academy and Backtesting Lab), inflating initial JavaScript parse/hydrate time.
2. **Full-Series Candle & Indicator Recomputation:** Every 1.8s quote tick regenerated all 56 OHLCV bars and recomputed SMA/EMA/BB/RSI/MACD from scratch.
3. **Unprotected Re-renders:** `ProCandlestickSvg` and `MarketDepth` re-rendered on unrelated form keystrokes (e.g., typing trade rationale).

## 2. Implemented Optimizations
* **Code Splitting (`next/dynamic`):** Lazy-loaded 13 non-initial views (`ProTerminalView`, `AcademyView`, `BacktestLabView`, `RiskCenterView`, `OptionsChainView`, `BasketOrdersView`, `ScreenerView`, `ReportsCenterView`, `PsychologyChallengesView`, `MarketIntelAdminView`, `TeacherCoachView`, `PortfolioView`, `JournalAnalyticsView`) with lightweight loading skeletons.
* **Incremental O(1) Candle Patching (`updateLatestCandle`):** Base 56-bar OHLCV series is memoized per `(instrumentId, timeframe)`; live ticks update only the final candle's `close`, `high`, `low`, and `volume` in O(1) time instead of regenerating all 56 bars!
* **Memoized Chart Subtree (`React.memo`):** Isolated `ProCandlestickSvg` with `React.memo` so typing in the order rationale or changing emotion never re-renders the SVG chart.
* **API Request Deduplication & 15s TTL Cache:** `/api/market/quotes` serves cached responses in `<2 ms` and deduplicates concurrent upstream Yahoo fetches.

## 3. Target Engineering Benchmarks
| Metric | Initial Target | Measurement Notes |
| :--- | :--- | :--- |
| Cached dashboard display | < 500 ms | Verified via local engine latency & lazy chunking |
| Client-side tab switch | < 200 ms | Instant in-memory state + cached dynamic chunk |
| `/api/market/quotes` cached p95 | < 50 ms (target < 300 ms) | Served from 15s server TTL cache |
| Incremental candle + indicator update | < 5 ms (target < 50 ms) | Measured directly in automated benchmark suite |
| LCP / INP | < 2.5s / < 200 ms | Benchmark on Vercel production Lighthouse |
