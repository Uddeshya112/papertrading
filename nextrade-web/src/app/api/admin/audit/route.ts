import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeServerAction, type AppRole } from "@/lib/rbac-security";

const RATE_WINDOW_MS = 60_000;
const MAX_REQ_PER_MIN = 15;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, now: number): boolean {
  if (rateBuckets.size > 5_000) rateBuckets.clear();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQ_PER_MIN) return false;
  bucket.count += 1;
  return true;
}

function extractJwtAal(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { aal?: unknown };
    return typeof payload.aal === "string" ? payload.aal : null;
  } catch {
    return null;
  }
}

/**
 * Server-Side Authorized Admin Audit Endpoint (`GET /api/admin/audit`).
 * Enforces per-IP rate limiting, verifies Bearer JWT directly with Supabase Auth,
 * enforces `aal2` MFA claim + authoritative `public.profiles.role`, and returns only RLS-permitted logs.
 */
export async function GET(request: NextRequest) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip, now)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED: Too many admin audit requests. Retry in 60s." },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED: Missing Bearer access token." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICE_UNAVAILABLE: Supabase environment variables are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED: Invalid or expired session token." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, mfa_enabled, is_suspended")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profErr || !profile || profile.is_suspended) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN: Account profile unavailable or suspended." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const tokenAal = extractJwtAal(token);
  const mfaVerified = Boolean(profile.mfa_enabled) && tokenAal === "aal2";

  const decision = authorizeServerAction({
    role: profile.role as AppRole,
    permission: "READ_AUDIT_LOGS",
    mfaVerified,
  });

  if (!decision.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `FORBIDDEN: ${decision.reason}${tokenAal !== "aal2" ? " (aal2 MFA session required)" : ""}`,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: logs, error: logsErr } = await supabase
    .from("audit_logs")
    .select("seq, id, actor, action, resource_type, resource_id, prev_hash, entry_hash, created_at")
    .order("seq", { ascending: false })
    .limit(50);

  if (logsErr) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR: Failed to fetch audit logs." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      role: profile.role,
      aal: tokenAal,
      count: logs?.length ?? 0,
      logs: logs ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
