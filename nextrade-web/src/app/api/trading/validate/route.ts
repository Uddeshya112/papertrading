import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SIDES = new Set(["BUY", "SELL"]);
const ALLOWED_TYPES = new Set(["MARKET", "LIMIT", "AUTO-LIMIT", "SL", "SL-M", "BRACKET", "COVER"]);
const ALLOWED_PRODUCTS = new Set(["INTRADAY", "DELIVERY", "NRML"]);
const ALLOWED_TIF = new Set(["DAY", "GTC"]);

const RATE_WINDOW_MS = 60_000;
const MAX_REQ_PER_MIN = 60;
const MAX_BODY_BYTES = 16_384;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, now: number): boolean {
  if (rateBuckets.size > 10_000) rateBuckets.clear();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQ_PER_MIN) return false;
  bucket.count += 1;
  return true;
}

/**
 * Server-Side Simulated Order Payload Validator (`POST /api/trading/validate`).
 * Enforces per-IP rate limiting, payload size cap, order structure, numeric bounds,
 * and SL/Target invariants server-side without ever trusting client-supplied balances.
 */
export async function POST(request: NextRequest) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip, now)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED: Too many order validation requests. Retry shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "PAYLOAD_TOO_LARGE: Request exceeds 16 KB limit." },
      { status: 413 }
    );
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE: Request exceeds 16 KB limit." },
        { status: 413 }
      );
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON: Request body must be valid JSON." }, { status: 400 });
  }

  const instrumentId = typeof body.instrumentId === "string" ? body.instrumentId.trim() : "";
  const side = typeof body.side === "string" ? body.side : "";
  const orderType = typeof body.orderType === "string" ? body.orderType : "";
  const product = typeof body.product === "string" ? body.product : "";
  const tif = typeof body.tif === "string" ? body.tif : "DAY";
  const lots = typeof body.lots === "number" ? body.lots : Number(body.lots);

  if (!instrumentId || instrumentId.length > 64) {
    return NextResponse.json({ ok: false, error: "INVALID_INSTRUMENT: Missing or invalid instrumentId." }, { status: 400 });
  }
  if (!ALLOWED_SIDES.has(side)) {
    return NextResponse.json({ ok: false, error: "INVALID_SIDE: Must be BUY or SELL." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(orderType)) {
    return NextResponse.json({ ok: false, error: "INVALID_ORDER_TYPE: Unsupported order type." }, { status: 400 });
  }
  if (!ALLOWED_PRODUCTS.has(product)) {
    return NextResponse.json({ ok: false, error: "INVALID_PRODUCT: Must be INTRADAY, DELIVERY, or NRML." }, { status: 400 });
  }
  if (!ALLOWED_TIF.has(tif)) {
    return NextResponse.json({ ok: false, error: "INVALID_TIF: Must be DAY or GTC." }, { status: 400 });
  }
  if (!Number.isInteger(lots) || lots < 1 || lots > 10000) {
    return NextResponse.json({ ok: false, error: "INVALID_LOTS: Lots must be an integer between 1 and 10,000." }, { status: 400 });
  }

  const stopLossPrice = body.stopLossPrice !== undefined ? Number(body.stopLossPrice) : undefined;
  const targetPrice = body.targetPrice !== undefined ? Number(body.targetPrice) : undefined;
  const limitPrice = body.limitPrice !== undefined ? Number(body.limitPrice) : undefined;
  const triggerPrice = body.triggerPrice !== undefined ? Number(body.triggerPrice) : undefined;

  if (orderType === "COVER" && (!stopLossPrice || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0)) {
    return NextResponse.json({ ok: false, error: "MISSING_SL: Cover orders require a positive stopLossPrice." }, { status: 400 });
  }
  if (
    orderType === "BRACKET" &&
    (!stopLossPrice || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0 || !targetPrice || !Number.isFinite(targetPrice) || targetPrice <= 0)
  ) {
    return NextResponse.json({ ok: false, error: "MISSING_BRACKET_BOUNDS: Bracket orders require positive stopLossPrice and targetPrice." }, { status: 400 });
  }
  if ((orderType === "LIMIT" || orderType === "SL") && (!limitPrice || !Number.isFinite(limitPrice) || limitPrice <= 0)) {
    return NextResponse.json({ ok: false, error: "MISSING_LIMIT_PRICE: Limit/SL orders require a positive limitPrice." }, { status: 400 });
  }
  if ((orderType === "SL" || orderType === "SL-M") && (!triggerPrice || !Number.isFinite(triggerPrice) || triggerPrice <= 0)) {
    return NextResponse.json({ ok: false, error: "MISSING_TRIGGER_PRICE: SL/SL-M orders require a positive triggerPrice." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    executionMode: "SIMULATED",
    validatedAt: new Date().toISOString(),
  });
}
