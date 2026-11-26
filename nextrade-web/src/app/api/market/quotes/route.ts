import { NextRequest, NextResponse } from "next/server";
import {
  getCircuitState,
  marketTelemetry,
  type ProviderQuote,
} from "@/lib/market-provider";

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  "NSE:HINDUNILVR": "HINDUNILVR.NS",
  "NSE:RELIANCE": "RELIANCE.NS",
  "NSE:TCS": "TCS.NS",
  "NSE:HDFCBANK": "HDFCBANK.NS",
  "NSE:INFY": "INFY.NS",
  "NSE:ICICIBANK": "ICICIBANK.NS",
  "NSE:SBIN": "SBIN.NS",
  "NSE:TATAMOTORS": "TATAMOTORS.NS",
  "BSE:TITAN": "TITAN.BO",
  "BSE:MARUTI": "MARUTI.BO",
  "NFO:NIFTY-FUT": "^NSEI",
  "NFO:BANKNIFTY-FUT": "^NSEBANK",
  "NSE:NIFTYBEES": "NIFTYBEES.NS",
  "NSE:LIQUIDBEES": "LIQUIDBEES.NS",
  "CDS:USDINR-FUT": "INR=X",
};

// In-memory TTL cache + request deduplication + per-IP token bucket (30 req/min)
let cacheData: Record<string, ProviderQuote> | null = null;
let cacheExpiry = 0;
let inFlightFetch: Promise<Record<string, ProviderQuote>> | null = null;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, now: number): { allowed: boolean; retryAfterSec: number } {
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (bucket.count >= 30) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

async function fetchUpstreamQuotes(): Promise<Record<string, ProviderQuote>> {
  const results: Record<string, ProviderQuote> = {};
  const entries = Object.entries(YAHOO_SYMBOL_MAP);

  await Promise.allSettled(
    entries.map(async ([instrumentId, yahooSymbol]) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TradeGuruAI/2.0" },
        signal: AbortSignal.timeout(4500),
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
          }>;
        };
      };
      const meta = json?.chart?.result?.[0]?.meta;
      const last = meta?.regularMarketPrice;
      const prevClose = meta?.chartPreviousClose ?? last;
      if (typeof last !== "number" || !Number.isFinite(last) || last <= 0) return;

      const safePrev = typeof prevClose === "number" && prevClose > 0 ? prevClose : last;
      const change = Number((last - safePrev).toFixed(2));
      const changePercent = Number(((change / safePrev) * 100).toFixed(2));

      results[instrumentId] = {
        instrumentId,
        last: Number(last.toFixed(2)),
        prevClose: Number(safePrev.toFixed(2)),
        change,
        changePercent,
        source: "Yahoo Finance Public Feed (Delayed)",
        mode: "DELAYED",
        asOf: new Date().toISOString(),
      };
    })
  );

  return results;
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  const rl = checkRateLimit(ip, start);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (cacheData && start < cacheExpiry) {
    marketTelemetry.cacheHits += 1;
    marketTelemetry.lastLatencyMs = Date.now() - start;
    return NextResponse.json({
      ok: true,
      cached: true,
      latencyMs: marketTelemetry.lastLatencyMs,
      circuitState: getCircuitState(start),
      source: "Yahoo Finance Public Feed (Delayed)",
      quotes: cacheData,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        "CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
      },
    });
  }

  if (getCircuitState(start) === "OPEN") {
    return NextResponse.json(
      {
        ok: false,
        cached: Boolean(cacheData),
        circuitState: "OPEN",
        source: "Circuit Breaker Open (Client using Simulated Fallback)",
        quotes: cacheData ?? {},
      },
      { status: 503 }
    );
  }

  marketTelemetry.cacheMisses += 1;
  if (!inFlightFetch) {
    inFlightFetch = fetchUpstreamQuotes().finally(() => {
      inFlightFetch = null;
    });
  }

  const results = await inFlightFetch;
  const count = Object.keys(results).length;
  const latencyMs = Date.now() - start;
  marketTelemetry.lastLatencyMs = latencyMs;

  if (count > 0) {
    cacheData = results;
    cacheExpiry = Date.now() + 15_000;
    marketTelemetry.consecutiveFailures = 0;
    marketTelemetry.lastSuccessAt = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      cached: false,
      count,
      latencyMs,
      circuitState: "CLOSED",
      source: "Yahoo Finance Public Feed (Delayed)",
      quotes: results,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        "CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
      },
    });
  }

  marketTelemetry.upstreamErrors += 1;
  marketTelemetry.consecutiveFailures += 1;
  if (marketTelemetry.consecutiveFailures >= 3) {
    marketTelemetry.circuitOpenUntil = Date.now() + 60_000;
  }

  return NextResponse.json(
    {
      ok: false,
      cached: false,
      count: 0,
      latencyMs,
      circuitState: getCircuitState(),
      source: "Upstream Unavailable",
      quotes: {},
    },
    { status: 503 }
  );
}
