# TradeGuru AI — Database Data Dictionary

| Domain | Tables | Primary Key / Unique Constraints | Monetary & Precision Rules | Delete Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Identity** | `profiles`, `user_preferences`, `user_sessions` | `id` (`auth.users.id`), `user_id` | N/A (`app_role` enum for RBAC) | `ON DELETE CASCADE` from `auth.users` |
| **Accounts & Wallet** | `trading_accounts`, `account_settings`, `account_balances`, `ledger_entries` | `id` (UUID), `uq_ledger_idempotency (account_id, idempotency_key)` | Strict `NUMERIC(18,4)` — ZERO floats; `version` bigint optimistic lock | `ON DELETE RESTRICT` on balances & ledger |
| **Trading Lifecycle** | `orders`, `order_events`, `executions` | `uq_orders_client_idempotency`, `uq_executions_idempotency` | `NUMERIC(18,4)` qty, fill price, slippage, fees, taxes | `ON DELETE RESTRICT` (immutable fills) |
| **Portfolio** | `positions`, `holdings`, `portfolio_snapshots` | `uq_holdings_account_instrument`, `uq_snapshot_account_date` | `NUMERIC(18,4)` entry/cost/equity | `ON DELETE RESTRICT` |
| **Market & Derivatives** | `instruments`, `market_quotes`, `historical_candles`, `options_contracts`, `options_snapshots` | Composite PK `(instrument_id, timeframe, bucket_time)` | `NUMERIC(18,4)` OHLCV & Greeks; explicit `feed_mode` | `ON DELETE CASCADE` on catalog children |
| **Risk, Learning & AI** | `risk_profiles`, `risk_limits`, `risk_events`, `courses`, `lessons`, `quizzes`, `learning_progress`, `teacher_reviews`, `detected_mistakes`, `weakness_profiles` | Composite PK `(user_id, course_id)` | Check constraints on scores (`0..100`) & risk caps | `CASCADE` on non-financial preferences |
| **Journal, Backtest & Reports** | `trade_journals`, `journal_tags`, `journal_reflections`, `strategies`, `backtest_runs`, `backtest_trades`, `report_jobs`, `generated_reports` | `uq_trade_journals_idem`, `uq_reflection_per_journal` | `NUMERIC(18,4)` P&L & charges; SHA-256 checksum on reports | `RESTRICT` on `trade_journals` |
| **Security, Sync & Audit** | `notifications`, `sync_devices`, `sync_operations`, `user_devices`, `login_history`, `security_events`, `admin_actions`, `audit_logs` | `seq BIGSERIAL` + `entry_hash` SHA-256 chain | `inet` IP storage; `uq_sync_op_idem` | Append-only triggers block UPDATE/DELETE |
