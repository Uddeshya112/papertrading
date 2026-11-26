import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeServerAction, type AppRole } from "@/lib/rbac-security";

/**
 * Server-Side Authorized Admin Audit Endpoint (`GET /api/admin/audit`).
 * Never trusts frontend-supplied user_id or role — verifies Bearer JWT directly with Supabase Auth,
 * reads authoritative role from `public.profiles`, enforces mandatory admin MFA, and returns only RLS-permitted logs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED: Missing Bearer access token." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICE_UNAVAILABLE: Supabase environment variables are not configured." },
      { status: 503 }
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
      { status: 401 }
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
      { status: 403 }
    );
  }

  const decision = authorizeServerAction({
    role: profile.role as AppRole,
    permission: "READ_AUDIT_LOGS",
    mfaVerified: Boolean(profile.mfa_enabled),
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { ok: false, error: `FORBIDDEN: ${decision.reason}` },
      { status: 403 }
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
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    role: profile.role,
    count: logs?.length ?? 0,
    logs: logs ?? [],
  });
}
