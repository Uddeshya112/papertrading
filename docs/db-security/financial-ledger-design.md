# TradeGuru AI — Immutable Financial Ledger Design

## 1. Core Accounting Principles
1. **Zero Floating-Point Money:** Every PostgreSQL monetary column uses `NUMERIC(18,4)`; TypeScript reconciliation helpers (`rbac-security.ts`) use exact `BigInt` integer paise (`1 INR = 100 paise`).
2. **Append-Only Ledger (`ledger_entries`):** Historical rows can NEVER be updated or deleted (enforced by both RLS and `trg_ledger_immutable`). Every balance change—initial ₹10,00,000 capital, buy debit, brokerage, statutory tax, sell credit, or safe refill—appends a new row linked by `transaction_id` and `idempotency_key`.
3. **Atomic Balance Updates (`tg_post_ledger_entry`):** Locks the `account_balances` row (`SELECT ... FOR UPDATE`), verifies `idempotency_key` deduplication, inserts into `ledger_entries`, and increments `account_balances.version` in one atomic PostgreSQL transaction.
4. **Order Lifecycle Separation:** `orders` (current request state) → `order_events` (immutable state transitions) → `executions` (individual partial/full fills) → `ledger_entries` (resulting cash debits/credits).
5. **Reconciliation (`tg_reconcile_account_balance`):** Verifies `SUM(credit_amount - debit_amount) = account_balances.available_balance` with zero discrepancy (`0.0000`).
