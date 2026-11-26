/**
 * @module lib/cloud-sync
 * @description Offline-first Supabase cloud synchronization queue with exponential backoff and idempotency.
 *
 * Reliability Design:
 * - LocalStorage acts as immediate write-ahead persistence so zero user actions block on network latency.
 * - Failed cloud upserts queue into `tradeguru_pending_sync_v1` and retry with bounded exponential backoff
 *   when connectivity returns (`online` event in `app/page.tsx`).
 * - Syncs both account snapshot (`tradeguru_accounts`) and normalized tables (`profiles`, `learning_progress`,
 *   `tradeguru_journal_trades`, `tradeguru_refill_history`).
 */

import { computeBackoffDelayMs } from "./market-provider";
import type { PaperAccountState } from "./paper-engine";
import { getSupabase } from "./supabase";

export type CloudSyncStatus = "LOCAL_ONLY" | "SYNCING" | "SYNCED" | "OFFLINE_FALLBACK";

type PendingSyncJob = {
  userId: string;
  state: PaperAccountState;
  attempts: number;
  nextRetryAt: number;
};

const PENDING_QUEUE_KEY = "tradeguru_pending_sync_v1";

function savePendingJob(job: PendingSyncJob | null) {
  if (typeof window === "undefined") return;
  try {
    if (!job) window.localStorage.removeItem(PENDING_QUEUE_KEY);
    else window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(job));
  } catch {
    /* ignore quota errors */
  }
}

export function getPendingSyncJob(): PendingSyncJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingSyncJob) : null;
  } catch {
    return null;
  }
}

export async function pullAccountFromCloud(userId: string): Promise<PaperAccountState | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tradeguru_accounts")
      .select("snapshot_state")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.snapshot_state || typeof data.snapshot_state !== "object") {
      return null;
    }
    const snap = data.snapshot_state as Partial<PaperAccountState>;
    if (typeof snap.availableCash !== "number") return null;
    return snap as PaperAccountState;
  } catch {
    return null;
  }
}

/**
 * Idempotent cloud sync with offline detection, pending queue persistence, and exponential backoff.
 */
export async function pushAccountToCloud(
  userId: string,
  state: PaperAccountState,
  attempt = 0
): Promise<CloudSyncStatus> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    savePendingJob({
      userId,
      state,
      attempts: attempt + 1,
      nextRetryAt: Date.now() + computeBackoffDelayMs(attempt),
    });
    return "OFFLINE_FALLBACK";
  }

  try {
    const supabase = getSupabase();
    const { error: accErr } = await supabase.from("tradeguru_accounts").upsert(
      {
        user_id: userId,
        starting_capital: state.startingCapital,
        challenge_id: state.challengeId,
        available_cash: state.availableCash,
        brokerage_plan: state.brokeragePlan,
        simulate_slippage: state.simulateSlippage,
        slippage_bps: state.slippageBps,
        confirm_before_order: state.confirmBeforeOrder,
        auto_refill_enabled: state.autoRefillEnabled,
        auto_refill_threshold: state.autoRefillThreshold,
        reset_count: state.resetCount,
        risk_limits: state.riskLimits,
        notification_prefs: state.notificationPrefs,
        watchlist: state.watchlist,
        completed_course_ids: state.completedCourseIds,
        quiz_scores: state.quizScores,
        prerequisites: state.prerequisites,
        snapshot_state: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (accErr) throw accErr;

    // Ensure normalized `profiles` row exists for RBAC & relational FKs (role cannot be escalated via RLS)
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user?.id === userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          email: authUser.user.email ?? "",
          full_name: typeof authUser.user.user_metadata?.full_name === "string" ? authUser.user.user_metadata.full_name : "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }

    // Sync completed Academy courses into normalized `learning_progress`
    if (state.completedCourseIds.length > 0) {
      const progressRows = state.completedCourseIds.map((cid) => ({
        user_id: userId,
        course_id: cid,
        status: "COMPLETED",
        best_quiz_score: state.quizScores[cid] ?? 100,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("learning_progress").upsert(progressRows, { onConflict: "user_id,course_id" });
    }

    if (state.journal.length > 0) {
      const latestTrades = state.journal.slice(0, 25).map((t) => ({
        id: t.id,
        idempotency_key: t.id,
        user_id: userId,
        instrument_id: t.instrumentId,
        symbol: t.symbol,
        exchange: t.exchange,
        segment: t.segment,
        side: t.side,
        product: t.product,
        quantity: t.quantity,
        entry_price: t.entryPrice,
        exit_price: t.exitPrice,
        planned_stop_loss: t.plannedStopLoss ?? null,
        planned_target: t.plannedTarget ?? null,
        gross_pnl: t.grossPnl,
        charges: t.charges,
        net_pnl: t.netPnl,
        exit_reason: t.exitReason,
        followed_stop_loss: t.followedStopLoss,
        strategy: t.strategy,
        emotion: t.emotion,
        post_emotion: t.postEmotion ?? null,
        confidence_level: t.confidenceLevel,
        regime: t.regime,
        rationale: t.rationale,
        reflection: t.reflection,
        opened_at: t.openedAt,
        closed_at: t.closedAt,
      }));
      await supabase.from("tradeguru_journal_trades").upsert(latestTrades, { onConflict: "id" });
    }

    if (state.refillHistory.length > 0) {
      const refills = state.refillHistory.slice(0, 20).map((r) => ({
        id: r.id,
        idempotency_key: r.id,
        user_id: userId,
        mode: r.mode,
        reason: r.reason,
        balance_before: r.balanceBefore,
        amount_added: r.amountAdded,
        balance_after: r.balanceAfter,
        closed_positions_count: r.closedPositionsCount,
        cancelled_orders_count: r.cancelledOrdersCount,
        created_at: r.date,
      }));
      await supabase
        .from("tradeguru_refill_history")
        .upsert(refills, { onConflict: "id", ignoreDuplicates: true });
    }

    savePendingJob(null);
    return "SYNCED";
  } catch {
    savePendingJob({
      userId,
      state,
      attempts: attempt + 1,
      nextRetryAt: Date.now() + computeBackoffDelayMs(attempt),
    });
    return "OFFLINE_FALLBACK";
  }
}

export async function flushPendingSyncIfDue(): Promise<CloudSyncStatus | null> {
  const job = getPendingSyncJob();
  if (!job || Date.now() < job.nextRetryAt) return null;
  return pushAccountToCloud(job.userId, job.state, job.attempts);
}
