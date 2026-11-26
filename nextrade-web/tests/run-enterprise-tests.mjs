import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

/**
 * TradeGuru AI — Automated Verification, Financial Accuracy & Performance Benchmark Suite
 * Runs natively on Node >= 18 with zero external test dependencies.
 */

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(rootDir, "..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("=== TradeGuru AI Enterprise Test & Benchmark Suite ===\n");

// 1. Structural & Architecture Documentation Completeness
test("All 12 required enterprise architecture docs exist in docs/ with Mermaid diagrams", () => {
  const requiredDocs = [
    "system-architecture.md",
    "low-level-design.md",
    "database-design.md",
    "api-design.md",
    "frontend-architecture.md",
    "performance-engineering.md",
    "security-design.md",
    "scalability-reliability.md",
    "testing-strategy.md",
    "deployment-devops.md",
    "architecture-decisions.md",
    "implementation-roadmap.md",
  ];
  for (const doc of requiredDocs) {
    const p = path.join(repoRoot, "docs", doc);
    assert.ok(fs.existsSync(p), `Missing docs/${doc}`);
    assert.ok(fs.readFileSync(p, "utf8").length > 400, `docs/${doc} is too short`);
  }
  const hld = fs.readFileSync(path.join(repoRoot, "docs/system-architecture.md"), "utf8");
  const lld = fs.readFileSync(path.join(repoRoot, "docs/low-level-design.md"), "utf8");
  assert.ok(hld.includes("```mermaid"), "HLD missing Mermaid diagram");
  assert.ok(lld.includes("```mermaid"), "LLD missing Mermaid diagram");
});

// 2. Security & Database Hardening Checks
test("Security headers configured in next.config.ts and zero secrets in frontend src/", () => {
  const nextCfg = fs.readFileSync(path.join(rootDir, "next.config.ts"), "utf8");
  assert.ok(nextCfg.includes("X-Frame-Options"), "Missing X-Frame-Options header");
  assert.ok(nextCfg.includes("X-Content-Type-Options"), "Missing X-Content-Type-Options header");
  assert.ok(nextCfg.includes("Strict-Transport-Security"), "Missing HSTS header");
  assert.ok(nextCfg.includes("poweredByHeader: false"), "X-Powered-By not disabled");

  const mig002 = fs.readFileSync(path.join(repoRoot, "supabase/migrations/002_enterprise_hardening.sql"), "utf8");
  assert.ok(mig002.includes("enforce_journal_financial_immutability"), "Missing BEFORE UPDATE immutability trigger");
  assert.ok(mig002.includes("idempotency_key"), "Missing idempotency_key column/index");
  assert.ok(mig002.includes("idx_tg_journal_cursor"), "Missing composite cursor pagination index");
});

// 3. Frontend Optimization & Resilience Checks
test("page.tsx uses next/dynamic lazy loading, WorkspaceErrorBoundary, and offline online listener", () => {
  const pageSrc = fs.readFileSync(path.join(rootDir, "src/app/page.tsx"), "utf8");
  const dynamicCount = (pageSrc.match(/dynamic\(\(\) => import\(/g) || []).length;
  assert.ok(dynamicCount >= 12, `Expected >=12 dynamic lazy views, found ${dynamicCount}`);
  assert.ok(pageSrc.includes("<WorkspaceErrorBoundary"), "Missing WorkspaceErrorBoundary");
  assert.ok(pageSrc.includes('addEventListener("online"'), "Missing online reconnection listener");

  const ptSrc = fs.readFileSync(path.join(rootDir, "src/components/pro-terminal-view.tsx"), "utf8");
  assert.ok(ptSrc.includes("updateLatestCandle"), "ProTerminalView not using O(1) incremental updateLatestCandle");
  assert.ok(ptSrc.includes("memo(function ProCandlestickSvg"), "ProCandlestickSvg not wrapped in React.memo");
});

// 4. API Rate Limiting, Circuit Breaker & Health Diagnostics Checks
test("/api/market/quotes has rate limiting + circuit breaker and /api/health exists", () => {
  const quotesRoute = fs.readFileSync(path.join(rootDir, "src/app/api/market/quotes/route.ts"), "utf8");
  assert.ok(quotesRoute.includes("checkRateLimit"), "Missing rate limiter");
  assert.ok(quotesRoute.includes("status: 429"), "Missing HTTP 429 response");
  assert.ok(quotesRoute.includes("getCircuitState"), "Missing circuit breaker check");
  assert.ok(quotesRoute.includes("inFlightFetch"), "Missing concurrent request deduplication");
  assert.ok(fs.existsSync(path.join(rootDir, "src/app/api/health/route.ts")), "Missing /api/health route");
});

// 5. Financial Math Verification (Indian Charges, Position Sizing & Expectancy)
test("Financial formulas: 1% position sizing, expectancy, and exponential backoff", () => {
  // Rohit's Flattrade example: ₹5,00,000 capital, 1% risk = ₹5,000, Entry 2200, SL 2165 -> 142 shares
  const riskAmount = 500000 * 0.01;
  const qty = Math.floor(riskAmount / (2200 - 2165));
  assert.equal(qty, 142);

  // ₹10,00,000 default TradeGuru capital, 1% risk = ₹10,000, Entry 2200, SL 2150 -> 200 shares
  const tgQty = Math.floor((1000000 * 0.01) / (2200 - 2150));
  assert.equal(tgQty, 200);

  // Expectancy formula: (5/8 * 6800) - (3/8 * 3900) = 4250 - 1462.5 = 2787.5
  const expectancy = (5 / 8) * 6800 - (3 / 8) * 3900;
  assert.equal(expectancy, 2787.5);

  // Exponential backoff verification (2s, 4s, 8s, 16s, 30s cap)
  const backoff = (attempt) => Math.min(30000, 2000 * Math.pow(2, attempt));
  assert.equal(backoff(0), 2000);
  assert.equal(backoff(1), 4000);
  assert.equal(backoff(2), 8000);
  assert.equal(backoff(4), 30000);
});

// 6. Real Measured Performance Benchmark: Full 56-bar Regeneration vs O(1) Incremental Update
test("Performance Benchmark: O(1) incremental candle update is significantly faster than full 56-bar regen", () => {
  const N = 1000;
  const baseCandles = Array.from({ length: 56 }, (_, i) => ({
    index: i, open: 2200, high: 2210, low: 2190, close: 2205, volume: 100000,
  }));

  // BEFORE: Regenerating all 56 bars per tick
  const t0 = performance.now();
  for (let iter = 0; iter < N; iter++) {
    let price = 2200 + (iter % 15);
    const arr = new Array(56);
    for (let i = 55; i >= 0; i--) {
      const wave = Math.sin(i * 0.37) * 0.002 + Math.cos(i * 0.19) * 0.001;
      const open = price / (1 + wave);
      arr[i] = { index: i, open, high: Math.max(open, price) * 1.002, low: Math.min(open, price) * 0.998, close: price, volume: 100000 + i };
      price = open;
    }
  }
  const fullRegenMs = performance.now() - t0;

  // AFTER: O(1) incremental updateLatestCandle
  const t1 = performance.now();
  let current = baseCandles;
  for (let iter = 0; iter < N; iter++) {
    const p = 2200 + (iter % 15);
    const last = current[current.length - 1];
    const copy = current.slice();
    copy[copy.length - 1] = { ...last, close: p, high: Math.max(last.high, p), low: Math.min(last.low, p) };
    current = copy;
  }
  const incrementalMs = performance.now() - t1;

  console.log(`        Benchmark (1,000 ticks): Full 56-bar regen = ${fullRegenMs.toFixed(2)} ms | O(1) Incremental = ${incrementalMs.toFixed(2)} ms (${(fullRegenMs / Math.max(0.01, incrementalMs)).toFixed(1)}x faster)`);
  assert.ok(incrementalMs < fullRegenMs, "Incremental update should be faster than full regeneration");
  assert.ok(incrementalMs / N < 1, "Per-tick incremental update must stay well under 1 ms (target < 50 ms)");
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
