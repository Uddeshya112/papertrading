# TradeGuru AI — Incremental Migration & Rollback Guide

## 1. Non-Destructive Migration Order
Existing migrations (`001_tradeguru_schema.sql`, `002_enterprise_hardening.sql`) are preserved untouched. Apply migrations strictly in numeric order:
1. `001_tradeguru_schema.sql` — Initial live tables + RLS
2. `002_enterprise_hardening.sql` — Financial immutability trigger + idempotency + cursor indexes
3. `003_identity_and_profiles.sql` — `app_role`, `profiles`, `user_preferences`, `user_sessions`
4. `004_accounts_and_ledger.sql` — `trading_accounts`, `account_settings`, `account_balances`, `ledger_entries`
5. `005_orders_and_executions.sql` — `orders`, `order_events`, `executions`
6. `006_portfolio_and_positions.sql` — `positions`, `holdings`, `portfolio_snapshots`
7. `007_market_and_derivatives.sql` — `instruments`, `market_quotes`, `historical_candles`, `options_contracts`, `options_snapshots`
8. `008_risk_management.sql` — `risk_profiles`, `risk_limits`, `risk_events`
9. `009_learning_and_academy.sql` — `courses`, `lessons`, `quizzes`, `learning_progress`
10. `010_journal_and_backtesting.sql` — `trade_journals`, `journal_tags`, `journal_reflections`, `strategies`, `backtest_runs`, `backtest_trades`
11. `011_ai_teacher_and_challenges.sql` — `teacher_reviews`, `detected_mistakes`, `weakness_profiles`, `challenges`, `challenge_progress`, `achievements`, `report_jobs`, `generated_reports`
12. `012_notifications_sync_security_audit.sql` — `notifications`, `sync_operations`, `security_events`, `login_history`, `admin_actions`, hash-chained `audit_logs`
13. `013_indexes_and_performance.sql` — Composite cursor, partial, and FTS indexes
14. `014_rls_policies.sql` — `ENABLE + FORCE ROW LEVEL SECURITY` & RBAC policies
15. `015_database_functions.sql` — Atomic `SECURITY DEFINER` RPCs, reconciliation & immutability triggers

## 2. Safe Rollback Procedure
* **Never run `DROP TABLE` on populated production financial tables.**
* If a function or policy migration (`014` or `015`) requires rollback, re-apply the prior function/policy definition inside a `BEGIN ... COMMIT` transaction after taking a pre-migration snapshot.
* Verify every migration in staging with `supabase/tests/rls_and_ledger_security_test.sql` before promoting to production.
