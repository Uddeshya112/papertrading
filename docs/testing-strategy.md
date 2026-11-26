# TradeGuru AI — Testing & Quality Assurance Strategy

## 1. Test Pyramid
1. **Unit & Financial Accuracy Tests (`nextrade-web/tests/run-tests.mjs`):**
   - Indian Charges (Brokerage, STT/CTT, Exchange, SEBI, Stamp Duty, 18% GST) & Rohit's ₹5L position sizing math.
   - Order placement (Market, Limit, Auto-Limit, SL, SL-M, Bracket, Cover), short-sale CNC block, insufficient margin rejection, and **Partial Fill** + remainder completion.
   - Safe **₹10,00,000 Auto & Manual Refill** verifying 100% preservation of historical trades, refill ledger, and audit log.
   - **AI Trading Teacher** verifying Good Process Loss recognition vs. Missing Stop-Loss / Revenge Trading detection.
   - **Backtesting Engine** verifying zero look-ahead bias, Indian cost deduction, and Monte Carlo bounds.
   - **Report Center** verifying HTML escaping (XSS safety), CSV formatting, and Excel SpreadsheetML structure.
   - **Offline Sync Queue** verifying deduplication, offline queueing, and exponential backoff calculation.
2. **Performance Micro-Benchmarks (in `run-tests.mjs`):**
   - Measures actual execution time (ms) for 100 incremental candle + indicator updates, 100 Options Chain generations, and full backtest + 200-run Monte Carlo latency.
3. **Static Type, Import, SQL & Security Verification:**
   - Verifies zero unresolved `@/` or relative imports, zero frontend secret exposure, valid Supabase RLS & `BEFORE UPDATE` immutability triggers.
4. **End-to-End & Production Smoke Tests (On Local / Vercel):**
   - Run `npm run lint && npm run build`, verify `/api/health` returns `200 OK`, verify Supabase auth PKCE signup → order placement → close position → AI Teacher diagnosis → PDF/CSV/Excel report download.
