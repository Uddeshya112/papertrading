# TradeGuru AI — Data Classification & Retention Policy

| Tier | Examples | Storage & Encryption | Access Control | Retention |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 — Restricted / Auth Secrets** | Passwords, MFA seeds, JWT signing keys, `SUPABASE_SERVICE_ROLE_KEY` | Managed solely by Supabase Auth & Vercel Secret Manager (AES-256 at rest, TLS 1.3 in transit); NEVER stored in repo or client JS. | Auth service only; admins have zero access to user passwords. | Active session / rotated on reset |
| **Tier 2 — Confidential Financial & Security** | `ledger_entries`, `account_balances`, `orders`, `executions`, `trade_journals`, `audit_logs`, `login_history` | Supabase PostgreSQL encrypted at rest (AES-256) + encrypted automated backups. | Strict `FORCE RLS` (`auth.uid()`); audit tables restricted to `security_admin`, `super_admin`, `auditor`. | Immutable (append-only); retained for account lifetime |
| **Tier 3 — Personal Identifiable (PII)** | `profiles` (`email`, `full_name`, `phone`, `country`), `user_sessions` (`ip_address`) | Encrypted PostgreSQL storage; never logged in plain text error messages. | Own user only; explicit audited justification for support. | Deleted upon account deletion (`ON DELETE CASCADE` on non-financial PII) |
| **Tier 4 — Public Educational / Market** | `instruments`, `market_quotes`, `courses`, `lessons`, `quizzes`, `challenges` | PostgreSQL + 15s BFF TTL cache. | Authenticated read-only. | Rolling market quotes; versioned curriculum |
