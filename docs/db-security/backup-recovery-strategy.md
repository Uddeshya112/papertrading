# TradeGuru AI — Backup, Disaster Recovery & RPO/RTO Strategy

## 1. Recovery Objectives
* **RPO (Recovery Point Objective):** `≤ 5 minutes` (using Supabase Point-in-Time Recovery / WAL archiving on Pro plan; `≤ 24 hours` on Free daily snapshots).
* **RTO (Recovery Time Objective):** `≤ 30 minutes` for full database restore + Vercel frontend verification.

## 2. Backup Controls
* Automated daily encrypted backups (AES-256) stored in isolated Supabase backup storage with restricted IAM access.
* Offline-first browser `localStorage` + pending sync queue (`cloud-sync.ts`) ensures in-progress user trades are never lost during transient outages.

## 3. Quarterly Restore Verification Drill
1. Restore latest encrypted backup into an isolated staging Supabase project.
2. Run `SELECT * FROM tg_reconcile_account_balance(id)` across sampled accounts to verify zero ledger/balance drift.
3. Verify `audit_logs` SHA-256 hash chain continuity and execute `supabase/tests/rls_and_ledger_security_test.sql`.
4. Record restore duration (actual RTO) and checksum results in the operational runbook.
