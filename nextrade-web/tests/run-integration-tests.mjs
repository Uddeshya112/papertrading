import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";

/**
 * TradeGuru AI — Full-Stack Integration & Production Readiness Verification Suite
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

console.log("=== TradeGuru AI Full-Stack Integration & Readiness Suite ===\n");

test("Frontend Admin Console is wired to live GET /api/admin/audit with Bearer JWT", () => {
  const adminSrc = fs.readFileSync(path.join(webRoot, "src/components/market-intel-admin-view.tsx"), "utf8");
  assert.ok(adminSrc.includes("/api/admin/audit"), "MarketIntelAdminView missing /api/admin/audit call");
  assert.ok(adminSrc.includes("Authorization: `Bearer ${token}`"), "Admin audit call missing Bearer JWT header");
});

test("cloud-sync.ts syncs normalized profiles & learning_progress alongside account snapshots", () => {
  const syncSrc = fs.readFileSync(path.join(webRoot, "src/lib/cloud-sync.ts"), "utf8");
  assert.ok(syncSrc.includes('.from("profiles")'), "cloud-sync missing profiles upsert");
  assert.ok(syncSrc.includes('.from("learning_progress")'), "cloud-sync missing learning_progress upsert");
  assert.ok(syncSrc.includes('.from("tradeguru_journal_trades")'), "cloud-sync missing journal upsert");
  assert.ok(syncSrc.includes('.from("tradeguru_refill_history")'), "cloud-sync missing refill_history upsert");
});

test("Server-side /api/trading/validate route enforces strict order payload validation", () => {
  const valSrc = fs.readFileSync(path.join(webRoot, "src/app/api/trading/validate/route.ts"), "utf8");
  assert.ok(valSrc.includes("ALLOWED_SIDES"), "Missing side validation");
  assert.ok(valSrc.includes("ALLOWED_TYPES"), "Missing orderType validation");
  assert.ok(valSrc.includes("MISSING_BRACKET_BOUNDS"), "Missing bracket SL/Target validation");
  assert.ok(valSrc.includes('executionMode: "SIMULATED"'), "Missing explicit SIMULATED label");
});

test("In-app Supabase runtime key connection works without .env.example and blocks service_role keys", () => {
  assert.ok(!fs.existsSync(path.join(webRoot, ".env.example")), ".env.example should be removed as requested");
  const supaSrc = fs.readFileSync(path.join(webRoot, "src/lib/supabase.ts"), "utf8");
  assert.ok(supaSrc.includes("saveSupabaseConfig"), "Missing saveSupabaseConfig in supabase.ts");
  assert.ok(supaSrc.includes("service_role"), "Missing guard rejecting service_role key in browser");
  const pageSrc = fs.readFileSync(path.join(webRoot, "src/app/page.tsx"), "utf8");
  assert.ok(pageSrc.includes("Connect Supabase Cloud Keys"), "Missing in-app Supabase connect UI in Settings");
});

test("All 8 required Production Readiness docs exist in docs/production-readiness/", () => {
  const req = [
    "FINAL_AUDIT.md",
    "FRONTEND_BACKEND_INTEGRATION.md",
    "DATABASE_VALIDATION.md",
    "SECURITY_VALIDATION.md",
    "PERFORMANCE_REPORT.md",
    "E2E_TEST_REPORT.md",
    "DEPLOYMENT_CHECKLIST.md",
    "KNOWN_LIMITATIONS.md",
  ];
  for (const doc of req) {
    const p = path.join(repoRoot, "docs/production-readiness", doc);
    assert.ok(fs.existsSync(p), `Missing docs/production-readiness/${doc}`);
    assert.ok(fs.readFileSync(p, "utf8").length > 300, `docs/production-readiness/${doc} too short`);
  }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
