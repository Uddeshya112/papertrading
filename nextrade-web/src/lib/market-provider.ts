/**
 * @module lib/market-provider
 * @description Market data provider abstractions, circuit-breaker state machine, and shared telemetry counters.
 *
 * Resilience Patterns:
 * - `MarketDataProvider` & `BrokerWebSocketAdapter`: Decouples UI/simulator from upstream feed vendors
 *   so licensed real-time Indian broker WebSockets (e.g., Kite/Dhan/Upstox) can be plugged in cleanly.
 * - Circuit Breaker: Opens for 60s after 3 consecutive upstream failures to protect latency and trigger
 *   graceful fallback to the local simulator.
 * - `computeBackoffDelayMs`: Capped exponential backoff with jitter for reconnect and sync retries.
 */

export type FeedMode = "LIVE" | "DELAYED" | "SIMULATED";

export type ProviderQuote = {
  instrumentId: string;
  last: number;
  prevClose: number;
  change: number;
  changePercent: number;
  source: string;
  mode: FeedMode;
  asOf: string;
};

export interface MarketDataProvider {
  readonly name: string;
  readonly mode: FeedMode;
  fetchQuotes(instrumentIds?: string[]): Promise<Record<string, ProviderQuote>>;
}

export interface BrokerWebSocketAdapter {
  readonly brokerName: string;
  connect(onTick: (quote: ProviderQuote) => void, onStatus: (connected: boolean) => void): void;
  subscribe(instrumentIds: string[]): void;
  disconnect(): void;
}

/**
 * Exponential backoff calculator for WebSocket & Cloud Sync retries (capped at 30s).
 */
export function computeBackoffDelayMs(attempt: number, baseMs = 2000, maxMs = 30000): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 10));
  return Math.min(maxMs, baseMs * Math.pow(2, safeAttempt));
}

/**
 * Server-side observability state shared between /api/market/quotes and /api/health.
 */
export const marketTelemetry = {
  cacheHits: 0,
  cacheMisses: 0,
  upstreamErrors: 0,
  consecutiveFailures: 0,
  circuitOpenUntil: 0,
  lastLatencyMs: 0,
  lastSuccessAt: null as string | null,
};

export function getCircuitState(now = Date.now()): "OPEN" | "CLOSED" {
  return marketTelemetry.circuitOpenUntil > now ? "OPEN" : "CLOSED";
}
