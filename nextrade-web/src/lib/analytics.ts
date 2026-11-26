/**
 * @module lib/analytics
 * @description Portfolio analytics, mathematical expectancy, drawdown, and Go-Live readiness engine.
 *
 * Core Algorithms:
 * - Expectancy: `(WinRate * AvgWin) - (LossRate * AvgLoss)` net of Indian statutory charges.
 * - Peak-to-Trough Drawdown: Single-pass O(N) equity-curve scan tracking running high-water mark.
 * - Go-Live Readiness: Multi-criterion checklist (50+ trades, positive net expectancy, <=10% drawdown,
 *   multi-regime stress testing, and stop-loss discipline).
 *
 * Interactions: Consumed by `journal-analytics-view.tsx`, `teacher-coach.ts`, `risk-center-view.tsx`,
 * and `report-center.ts`.
 */

import { formatINR } from "./format";
import type { JournalTrade, PaperAccountState } from "./paper-engine";
import type { MarketRegime } from "./paper-instruments";

export type EquityPoint = {
  tradeIndex: number;
  label: string;
  equity: number;
  drawdownPercent: number;
};

export type StrategyMetric = {
  strategy: string;
  trades: number;
  winRate: number;
  netPnl: number;
  expectancy: number;
};

export type GoLiveCheck = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  progressText: string;
};

export type AnalyticsSummary = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0..100
  avgWin: number;
  avgLoss: number; // positive magnitude
  expectancyPerTrade: number; // (WinRate * AvgWin) - (LossRate * AvgLoss)
  profitFactor: number;
  grossPnl: number;
  totalCharges: number;
  netPnl: number;
  returnPercent: number;
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  stopLossDisciplinePercent: number;
  regimesTested: MarketRegime[];
  equityCurve: EquityPoint[];
  strategyBreakdown: StrategyMetric[];
  goLiveChecks: GoLiveCheck[];
  readinessScore: number; // 0..100
  recommendedInitialLiveCapitalMin: number;
  recommendedInitialLiveCapitalMax: number;
};

export function computeAnalytics(state: PaperAccountState): AnalyticsSummary {
  // Journal is stored newest-first; sort oldest-first for equity curve
  const chronological = [...state.journal].reverse();
  const totalTrades = chronological.length;

  let wins = 0;
  let losses = 0;
  let sumWin = 0;
  let sumLoss = 0;
  let grossPnl = 0;
  let totalCharges = 0;
  let netPnl = 0;
  let slFollowedCount = 0;

  const regimeSet = new Set<MarketRegime>();
  const strategyMap = new Map<string, JournalTrade[]>();

  let runningEquity = state.startingCapital;
  let peakEquity = state.startingCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  const equityCurve: EquityPoint[] = [
    { tradeIndex: 0, label: "Start", equity: round2(runningEquity), drawdownPercent: 0 },
  ];

  chronological.forEach((trade, idx) => {
    grossPnl += trade.grossPnl;
    totalCharges += trade.charges;
    netPnl += trade.netPnl;
    regimeSet.add(trade.regime);
    if (trade.followedStopLoss) slFollowedCount++;

    if (trade.netPnl >= 0) {
      wins++;
      sumWin += trade.netPnl;
    } else {
      losses++;
      sumLoss += Math.abs(trade.netPnl);
    }

    const bucket = strategyMap.get(trade.strategy) ?? [];
    bucket.push(trade);
    strategyMap.set(trade.strategy, bucket);

    runningEquity += trade.netPnl;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const ddAmt = peakEquity - runningEquity;
    const ddPct = peakEquity > 0 ? (ddAmt / peakEquity) * 100 : 0;
    if (ddAmt > maxDrawdownAmount) maxDrawdownAmount = ddAmt;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    equityCurve.push({
      tradeIndex: idx + 1,
      label: `#${idx + 1} ${trade.symbol}`,
      equity: round2(runningEquity),
      drawdownPercent: round2(ddPct),
    });
  });

  const winRateFraction = totalTrades > 0 ? wins / totalTrades : 0;
  const lossRateFraction = totalTrades > 0 ? losses / totalTrades : 0;
  const avgWin = wins > 0 ? sumWin / wins : 0;
  const avgLoss = losses > 0 ? sumLoss / losses : 0;

  // Exact Flattrade Guide Formula: (Win Rate × Average Win) − (Loss Rate × Average Loss)
  const expectancyPerTrade = round2(winRateFraction * avgWin - lossRateFraction * avgLoss);
  const profitFactor = sumLoss > 0 ? Number((sumWin / sumLoss).toFixed(2)) : sumWin > 0 ? 9.99 : 0;
  const returnPercent = state.startingCapital > 0 ? round2((netPnl / state.startingCapital) * 100) : 0;
  const stopLossDisciplinePercent = totalTrades > 0 ? round2((slFollowedCount / totalTrades) * 100) : 100;

  const strategyBreakdown: StrategyMetric[] = Array.from(strategyMap.entries())
    .map(([strategy, trades]) => {
      const w = trades.filter((t) => t.netPnl >= 0);
      const l = trades.filter((t) => t.netPnl < 0);
      const wr = trades.length > 0 ? w.length / trades.length : 0;
      const lr = trades.length > 0 ? l.length / trades.length : 0;
      const aw = w.length > 0 ? w.reduce((a, b) => a + b.netPnl, 0) / w.length : 0;
      const al = l.length > 0 ? l.reduce((a, b) => a + Math.abs(b.netPnl), 0) / l.length : 0;
      return {
        strategy,
        trades: trades.length,
        winRate: round2(wr * 100),
        netPnl: round2(trades.reduce((a, b) => a + b.netPnl, 0)),
        expectancy: round2(wr * aw - lr * al),
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  const regimesTested = Array.from(regimeSet);

  const goLiveChecks: GoLiveCheck[] = [
    {
      id: "sample_size",
      label: "Statistically Meaningful Sample (50–100 Trades)",
      detail: "Build a track record of at least 50 closed paper trades instead of relying on a short lucky streak.",
      passed: totalTrades >= 50,
      progressText: `${totalTrades} / 50 trades`,
    },
    {
      id: "positive_expectancy",
      label: "Positive Expectancy Net of Indian Costs",
      detail: "Expectancy per trade must stay above ₹0 after accounting for STT/CTT, GST, SEBI fees, and stamp duty.",
      passed: totalTrades > 0 && expectancyPerTrade > 0,
      progressText: totalTrades > 0 ? `${formatINR(expectancyPerTrade)}/trade` : "No closed trades",
    },
    {
      id: "market_regimes",
      label: "Tested Across Multiple Market Conditions",
      detail: "Stress-test your strategy across at least 2 regimes (Bull, Sideways, Correction, or Volatility Spike).",
      passed: regimesTested.length >= 2,
      progressText: `${regimesTested.length} / 2 regimes`,
    },
    {
      id: "drawdown_control",
      label: "Max Drawdown Controlled (≤ 10%)",
      detail: "Keep peak-to-trough virtual equity decline at or below 10%.",
      passed: maxDrawdownPercent <= 10,
      progressText: `${maxDrawdownPercent.toFixed(1)}% max DD`,
    },
    {
      id: "sl_discipline",
      label: "Stop-Loss Discipline (≥ 80%)",
      detail: "Honor your pre-defined stop-losses instead of letting virtual losers run.",
      passed: totalTrades > 0 && stopLossDisciplinePercent >= 80,
      progressText: totalTrades > 0 ? `${stopLossDisciplinePercent.toFixed(0)}% adherence` : "Pending",
    },
  ];

  const passedCount = goLiveChecks.filter((c) => c.passed).length;
  const readinessScore = Math.round((passedCount / goLiveChecks.length) * 100);

  return {
    totalTrades,
    wins,
    losses,
    winRate: round2(winRateFraction * 100),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    expectancyPerTrade,
    profitFactor,
    grossPnl: round2(grossPnl),
    totalCharges: round2(totalCharges),
    netPnl: round2(netPnl),
    returnPercent,
    maxDrawdownAmount: round2(maxDrawdownAmount),
    maxDrawdownPercent: round2(maxDrawdownPercent),
    stopLossDisciplinePercent,
    regimesTested,
    equityCurve,
    strategyBreakdown,
    goLiveChecks,
    readinessScore,
    recommendedInitialLiveCapitalMin: round2(state.startingCapital * 0.1),
    recommendedInitialLiveCapitalMax: round2(state.startingCapital * 0.2),
  };
}

export function exportJournalToCsv(journal: JournalTrade[]): string {
  const headers = [
    "Trade ID",
    "Symbol",
    "Exchange",
    "Segment",
    "Side",
    "Product",
    "Quantity",
    "Entry Price",
    "Exit Price",
    "Gross PnL (INR)",
    "Estimated Charges (INR)",
    "Net PnL (INR)",
    "Exit Reason",
    "Strategy",
    "Emotion",
    "Market Regime",
    "Rationale",
    "Reflection",
    "Closed At",
  ];
  const escape = (v: string | number | undefined) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const rows = journal.map((t) =>
    [
      t.id,
      t.symbol,
      t.exchange,
      t.segment,
      t.side,
      t.product,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.grossPnl,
      t.charges,
      t.netPnl,
      t.exitReason,
      t.strategy,
      t.emotion,
      t.regime,
      t.rationale,
      t.reflection,
      t.closedAt,
    ]
      .map(escape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
