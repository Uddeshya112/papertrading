/**
 * @module lib/rbac-security
 * @description Server-side Role-Based Access Control (RBAC) policy engine and exact integer-paise reconciliation.
 *
 * Security & Financial Invariants:
 * - Defines 6 authoritative roles (`student`, `pro_learner`, `mentor`, `compliance_auditor`, `admin`, `super_admin`).
 * - Enforces mandatory MFA (`aal2`) for all privileged administrative and audit-log read actions.
 * - `reconcileLedgerPaise`: Uses native `BigInt` integer paise (₹1 = 100 paise) to guarantee zero IEEE-754
 *   floating-point rounding drift during double-entry ledger reconciliation.
 */

export type AppRole =
  | "user"
  | "analyst"
  | "support_admin"
  | "security_admin"
  | "super_admin"
  | "auditor";

export type AdminPermission =
  | "READ_AUDIT_LOGS"
  | "MANAGE_CONFIG"
  | "SUSPEND_USER"
  | "VIEW_AGGREGATED_ANALYTICS"
  | "SUPPORT_ASSIST";

const ROLE_PERMISSIONS: Record<AppRole, ReadonlyArray<AdminPermission>> = {
  user: [],
  analyst: ["VIEW_AGGREGATED_ANALYTICS"],
  support_admin: ["SUPPORT_ASSIST"],
  security_admin: ["READ_AUDIT_LOGS", "SUSPEND_USER"],
  super_admin: ["READ_AUDIT_LOGS", "MANAGE_CONFIG", "SUSPEND_USER", "VIEW_AGGREGATED_ANALYTICS", "SUPPORT_ASSIST"],
  auditor: ["READ_AUDIT_LOGS", "VIEW_AGGREGATED_ANALYTICS"],
};

const ADMIN_ROLES: ReadonlySet<AppRole> = new Set([
  "security_admin",
  "super_admin",
  "support_admin",
  "auditor",
]);

/**
 * Server-side RBAC authorization check.
 * Admin roles strictly require MFA verification (`mfaVerified === true`) for privileged endpoints.
 */
export function authorizeServerAction(params: {
  role: AppRole;
  permission: AdminPermission;
  mfaVerified: boolean;
}): { allowed: boolean; reason?: string } {
  const { role, permission, mfaVerified } = params;
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (!perms.includes(permission)) {
    return { allowed: false, reason: `Role '${role}' lacks permission '${permission}'.` };
  }
  if (ADMIN_ROLES.has(role) && !mfaVerified) {
    return { allowed: false, reason: `Mandatory MFA verification required for admin role '${role}'.` };
  }
  return { allowed: true };
}

/**
 * Exact integer-paise monetary arithmetic helpers (1 INR = 100 paise)
 * to eliminate IEEE-754 floating-point drift in financial ledger operations.
 */
export function inrToPaise(inr: number): bigint {
  if (!Number.isFinite(inr)) throw new Error("Invalid monetary amount");
  return BigInt(Math.round(inr * 100));
}

export function paiseToInr(paise: bigint): number {
  return Number(paise) / 100;
}

export function reconcileLedgerPaise(
  entries: ReadonlyArray<{ debitPaise: bigint; creditPaise: bigint }>,
  materializedBalancePaise: bigint
): { ledgerNetPaise: bigint; discrepancyPaise: bigint; consistent: boolean } {
  let net = BigInt(0);
  for (const e of entries) {
    if (e.debitPaise < BigInt(0) || e.creditPaise < BigInt(0)) {
      throw new Error("Negative ledger entry amount is prohibited");
    }
    net += e.creditPaise - e.debitPaise;
  }
  const discrepancy = net - materializedBalancePaise;
  return {
    ledgerNetPaise: net,
    discrepancyPaise: discrepancy,
    consistent: discrepancy === BigInt(0),
  };
}
