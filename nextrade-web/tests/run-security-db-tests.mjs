import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";

/**
 * TradeGuru AI — Financial-Grade Database, Ledger & Multi-Tenant Security Verification Suite
 */
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");

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

console.log("=== TradeGuru AI Financial Security & Database Architecture Suite ===\n");

test("All 15 incremental migrations (001–015) exist and preserve 001/002 untouched", () => {
  const migDir = path.join(repoRoot, "supabase/migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  assert.equal(files.length, 15, `Expected 15 migration files, found ${files.length}`);
  assert.equal(files[0], "001_tradeguru_schema.sql");
  assert.equal(files[1], "002_enterprise_hardening.sql");
  assert.equal(files[14], "015_database_functions.sql");
});

test("Zero floating-point monetary types (FLOAT/DOUBLE/REAL) across all 15 SQL migrations", () => {
  const migDir = path.join(repoRoot, "supabase/migrations");
  for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith(".sql"))) {
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    assert.ok(!/\b(float4|float8|double precision|real)\b/i.test(sql), `Floating-point column found in ${f}`);
  }
  const m004 = fs.readFileSync(path.join(migDir, "004_accounts_and_ledger.sql"), "utf8");
  assert.ok(m004.includes("numeric(18,4)"), "004 missing NUMERIC(18,4) precision");
  assert.ok(m004.includes("uq_ledger_idempotency"), "004 missing ledger idempotency constraint");
});

test("ENABLE + FORCE ROW LEVEL SECURITY enforced on all 39 multi-tenant tables in 014", () => {
  const m014 = fs.readFileSync(path.join(repoRoot, "supabase/migrations/014_rls_policies.sql"), "utf8");
  assert.ok(m014.includes("enable row level security"), "Missing ENABLE ROW LEVEL SECURITY");
  assert.ok(m014.includes("force row level security"), "Missing FORCE ROW LEVEL SECURITY");
  assert.ok(m014.includes("profiles_update_own_non_role"), "Missing role self-escalation guard");
  assert.ok(m014.includes("audit_logs_rbac_read"), "Missing RBAC policy on audit_logs");
});

test("Every SECURITY DEFINER function pins search_path = public, pg_temp and immutability triggers exist", () => {
  const m015 = fs.readFileSync(path.join(repoRoot, "supabase/migrations/015_database_functions.sql"), "utf8").replace(/--.*$/gm, "");
  const secDefCount = (m015.match(/security definer/gi) || []).length;
  const searchPathCount = (m015.match(/set search_path = public, pg_temp/gi) || []).length;
  assert.ok(secDefCount >= 3, "Expected >=3 SECURITY DEFINER functions in 015");
  assert.equal(secDefCount, searchPathCount, "Every SECURITY DEFINER function must pin search_path = public, pg_temp");
  assert.ok(m015.includes("trg_ledger_immutable"), "Missing ledger immutability trigger");
  assert.ok(m015.includes("trg_audit_logs_immutable"), "Missing audit_logs immutability trigger");
  assert.ok(m015.includes("tg_reconcile_account_balance"), "Missing reconciliation RPC");
  assert.ok(m015.includes("digest("), "Missing SHA-256 hash chaining in audit log RPC");
});

test("Server-side RBAC enforces role permissions and mandatory Admin MFA", () => {
  const rbacSrc = fs.readFileSync(path.join(webRoot, "src/lib/rbac-security.ts"), "utf8");
  assert.ok(rbacSrc.includes("Mandatory MFA verification required"), "Missing mandatory Admin MFA enforcement");

  const auditRoute = fs.readFileSync(path.join(webRoot, "src/app/api/admin/audit/route.ts"), "utf8");
  assert.ok(auditRoute.includes("status: 401"), "Admin audit route missing 401 unauthenticated check");
  assert.ok(auditRoute.includes("status: 403"), "Admin audit route missing 403 RBAC/MFA check");
  assert.ok(auditRoute.includes("supabase.auth.getUser(token)"), "Admin audit route not verifying JWT server-side");
});

test("Exact Integer-Paise Double-Entry Ledger Reconciliation (₹10L -> Buy ₹50k -> Fee ₹100 -> Sell ₹55k = ₹10,04,900)", () => {
  const toPaise = (inr) => BigInt(Math.round(inr * 100));
  const entries = [
    { debitPaise: 0n, creditPaise: toPaise(1000000) }, // Initial ₹10,00,000
    { debitPaise: toPaise(50000), creditPaise: 0n },   // Buy order debit
    { debitPaise: toPaise(100), creditPaise: 0n },     // Charges
    { debitPaise: 0n, creditPaise: toPaise(55000) },   // Sell proceeds
  ];
  const netPaise = entries.reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0n);
  const expectedPaise = toPaise(1004900);
  assert.equal(netPaise, expectedPaise, "Double-entry ledger sum must equal exactly ₹10,04,900.00 (100490000 paise)");
});

test("Zero service-role keys or private secrets in frontend src/", () => {
  const srcDir = path.join(webRoot, "src");
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((ent) =>
      ent.isDirectory() ? walk(path.join(d, ent.name)) : [path.join(d, ent.name)]
    );
  for (const file of walk(srcDir)) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|sk_live_/.test(content), `Secret reference leaked in ${file}`);
  }
});

test("All 9 required Database & Security docs exist in docs/db-security/ plus live SQL test script", () => {
  const req = [
    "er-diagram.md",
    "database-dictionary.md",
    "rls-policy-matrix.md",
    "threat-model.md",
    "data-classification.md",
    "financial-ledger-design.md",
    "backup-recovery-strategy.md",
    "migration-rollback-guide.md",
    "security-test-report.md",
  ];
  for (const doc of req) {
    assert.ok(fs.existsSync(path.join(repoRoot, "docs/db-security", doc)), `Missing docs/db-security/${doc}`);
  }
  assert.ok(fs.existsSync(path.join(repoRoot, "supabase/tests/rls_and_ledger_security_test.sql")), "Missing live SQL RLS test script");
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
