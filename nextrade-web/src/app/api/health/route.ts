import { NextRequest, NextResponse } from "next/server";
import { getCircuitState, marketTelemetry } from "@/lib/market-provider";

const startedAt = Date.now();

/**
 * Health & Diagnostics Endpoint (`GET /api/health`).
 * Returns a lightweight Edge-cached liveness response publicly, and exposes detailed
 * memory/telemetry diagnostics only when `x-health-token` matches `HEALTH_CHECK_SECRET`.
 */
export async function GET(request: NextRequest) {
  const now = Date.now();
  const configuredSecret = process.env.HEALTH_CHECK_SECRET?.trim();
  const providedToken = request.headers.get("x-health-token")?.trim();
  const allowDetailed =
    process.env.NODE_ENV !== "production" ||
    (Boolean(configuredSecret) && providedToken === configuredSecret);

  if (!allowDetailed) {
    return NextResponse.json(
      {
        status: "ok",
        service: "tradeguru-ai-web",
        timestamp: new Date(now).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
        },
      }
    );
  }

  const totalLookups = marketTelemetry.cacheHits + marketTelemetry.cacheMisses;
  const cacheHitRatio =
    totalLookups > 0 ? Number(((marketTelemetry.cacheHits / totalLookups) * 100).toFixed(1)) : 0;
  const mem = typeof process !== "undefined" && process.memoryUsage ? process.memoryUsage() : null;

  return NextResponse.json(
    {
      status: "ok",
      service: "tradeguru-ai-web",
      uptimeSec: Math.floor((now - startedAt) / 1000),
      timestamp: new Date(now).toISOString(),
      supabaseConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      ),
      marketFeed: {
        circuitState: getCircuitState(now),
        cacheHits: marketTelemetry.cacheHits,
        cacheMisses: marketTelemetry.cacheMisses,
        cacheHitRatioPct: cacheHitRatio,
        upstreamErrors: marketTelemetry.upstreamErrors,
        lastLatencyMs: marketTelemetry.lastLatencyMs,
        lastSuccessAt: marketTelemetry.lastSuccessAt,
      },
      memoryMb: mem ? Number((mem.rss / (1024 * 1024)).toFixed(1)) : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
