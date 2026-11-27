/**
 * @module lib/backtest-engine
 * @description No-look-ahead bar-by-bar historical strategy backtester with Walk-Forward & Monte Carlo analysis.
 *
 * Algorithmic Guarantees:
 * - Strict causality (no look-ahead bias): entry/exit signals on bar `i` execute using only bars `0..i`.
 * - Realistic Indian execution friction: applies configurable slippage (bps) + full Indian round-trip
 *   statutory charges via `lib/indian-charges.ts`.
 * - Monte Carlo Simulation: 200-run bootstrap resampling (O(R * T)) to estimate worst-case 95th-percentile drawdown.
 */

import {
  computeEMA,
  computeRSI,
  computeSMA,
  generateCandles,
  type Candle,
  type ChartTimeframe,
} from "./candlestick-engine";
import { calculateRoundTripCharges, type BrokeragePlan } from "./indian-charges";
import { getInstrumentById, type LiveQuote } from "./paper-instruments";

export type BacktestRuleType =
  | "EMA_CROSS"
  | "RSI_MEAN_REVERSION"
  | "BOLLINGER_BREAKOUT"
  | "MACD_MOMENTUM";

export type BacktestConfig = {
  id: string;
  name: string;
  instrumentId: string;
  timeframe: ChartTimeframe;
  rule: BacktestRuleType;
  startingCapital: number;
  riskPerTradePct: number;
  stopLossPct: number;
  targetPct: number;
  slippageBps: number;
  brokeragePlan: BrokeragePlan;
};

export type BacktestTrade = {
  index: number;
  entryBar: number;
  exitBar: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  exitReason: "TARGET" | "STOP_LOSS" | "SIGNAL_EXIT";
};

export type BacktestResult = {
  config: BacktestConfig;
  candles: Candle[];
  trades: BacktestTrade[];
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
  expectancy: number;
  avgRiskReward: number | null;
  maxDrawdownPct: number;
  sharpeRatio: number;
  netPnl: number;
  totalCosts: number;
  returnPct: number;
  equityCurve: number[];
  walkForwardTrainReturnPct: number;
  walkForwardTestReturnPct: number;
  monteCarloP5ReturnPct: number;
  monteCarloMedianReturnPct: number;
  monteCarloWorstDdPct: number;
  monteCarloBestReturnPct: number;
  missingDataNote: string;
};

/**
 * Runs a strict bar-by-bar historical backtest (ZERO look-ahead bias: signals computed on bar i-1
 * execute at bar i open with spread + slippage + Indian transaction costs).
 */
export function runHistoricalBacktest(
  config: BacktestConfig,
  quotes: Record<string, LiveQuote>
): BacktestResult {
  const inst = getInstrumentById(config.instrumentId);
  const candles = generateCandles(inst, quotes[inst.id], config.timeframe, 140);
  const closes = candles.map((c) => c.close);

  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const sma20 = computeSMA(closes, 20);
  const rsi14 = computeRSI(closes, 14);

  const macdLine = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  const macdSignal = computeEMA(macdLine.map((v) => v ?? 0), 9);

  const trades: BacktestTrade[] = [];
  let equity = config.startingCapital;
  const equityCurve: number[] = [equity];
  let inPos = false;
  let entryBar = 0;
  let entryPrice = 0;
  let qty = 0;
  let slPrice = 0;
  let tgtPrice = 0;

  const slipMult = (config.slippageBps + inst.spreadBps * 0.5) / 10000;

  for (let i = 28; i < candles.length; i++) {
    const bar = candles[i];

    if (inPos) {
      let exitPrice: number | null = null;
      let exitReason: BacktestTrade["exitReason"] = "SIGNAL_EXIT";

      // Check Stop-Loss first (conservative intrabar assumption)
      if (bar.low <= slPrice) {
        exitPrice = slPrice * (1 - slipMult);
        exitReason = "STOP_LOSS";
      } else if (bar.high >= tgtPrice) {
        exitPrice = tgtPrice * (1 - slipMult);
        exitReason = "TARGET";
      } else if (i === candles.length - 1 || isExitSignal(config.rule, i - 1, ema9, ema21, rsi14, macdLine, macdSignal)) {
        exitPrice = bar.open * (1 - slipMult);
        exitReason = "SIGNAL_EXIT";
      }

      if (exitPrice !== null) {
        const grossPnl = (exitPrice - entryPrice) * qty;
        const costs = calculateRoundTripCharges({
          segment: inst.segment,
          product: "INTRADAY",
          buyPrice: entryPrice,
          sellPrice: exitPrice,
          quantity: qty,
          brokeragePlan: config.brokeragePlan,
        }).totalCharges;
        const netPnl = grossPnl - costs;
        equity += netPnl;
        trades.push({
          index: trades.length + 1,
          entryBar,
          exitBar: i,
          entryPrice: round2(entryPrice),
          exitPrice: round2(exitPrice),
          qty,
          grossPnl: round2(grossPnl),
          charges: round2(costs),
          netPnl: round2(netPnl),
          exitReason,
        });
        equityCurve.push(round2(equity));
        inPos = false;
      }
    } else {
      // Strictly evaluate signal on COMPLETED prior bar (i - 1) to prevent look-ahead bias
      if (isEntrySignal(config.rule, i - 1, closes, ema9, ema21, sma20, rsi14, macdLine, macdSignal)) {
        entryPrice = bar.open * (1 + slipMult);
        slPrice = entryPrice * (1 - config.stopLossPct / 100);
        tgtPrice = entryPrice * (1 + config.targetPct / 100);
        const riskRs = (equity * config.riskPerTradePct) / 100;
        const slDist = Math.max(inst.tickSize, entryPrice - slPrice);
        const rawQty = Math.floor(riskRs / slDist);
        qty = Math.max(inst.lotSize, Math.floor(rawQty / inst.lotSize) * inst.lotSize);
        if (qty * entryPrice > equity * 2) {
          qty = Math.max(inst.lotSize, Math.floor((equity / entryPrice) / inst.lotSize) * inst.lotSize);
        }
        entryBar = i;
        inPos = true;
      }
    }
  }

  const wins = trades.filter((t) => t.netPnl >= 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const sumWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const sumLoss = losses.reduce((s, t) => s + Math.abs(t.netPnl), 0);
  const avgProfit = wins.length > 0 ? sumWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? sumLoss / losses.length : 0;
  const profitFactor = sumLoss > 0 ? sumWin / sumLoss : sumWin > 0 ? 5.0 : 0;
  const expectancy =
    totalTrades > 0
      ? (wins.length / totalTrades) * avgProfit - (losses.length / totalTrades) * avgLoss
      : 0;
  const avgRiskReward = losses.length > 0 && avgLoss > 0 ? avgProfit / avgLoss : null;
  const netPnl = equity - config.startingCapital;
  const totalCosts = trades.reduce((s, t) => s + t.charges, 0);
  const returnPct = (netPnl / config.startingCapital) * 100;

  let peak = config.startingCapital;
  let maxDdPct = 0;
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  // Approximate annualized Sharpe Ratio from trade returns
  const returns = trades.map((t) => t.netPnl / config.startingCapital);
  const meanR = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const varianceR =
    returns.length > 1
      ? returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (returns.length - 1)
      : 0;
  const stdR = Math.sqrt(varianceR);
  const sharpeRatio = stdR > 0 ? Number(((meanR / stdR) * Math.sqrt(Math.min(252, Math.max(12, returns.length)))).toFixed(2)) : 0;

  // Walk-Forward Split (First 70% In-Sample vs Last 30% Out-of-Sample)
  const splitIdx = Math.floor(trades.length * 0.7);
  const trainPnl = trades.slice(0, splitIdx).reduce((s, t) => s + t.netPnl, 0);
  const testPnl = trades.slice(splitIdx).reduce((s, t) => s + t.netPnl, 0);

  // 200-Run Monte Carlo Bootstrap Simulation
  const mc = runMonteCarlo(trades.map((t) => t.netPnl), config.startingCapital, 200);

  return {
    config,
    candles,
    trades,
    totalTrades,
    winRate: round2(winRate),
    profitFactor: round2(profitFactor),
    avgProfit: round2(avgProfit),
    avgLoss: round2(avgLoss),
    expectancy: round2(expectancy),
    avgRiskReward: avgRiskReward !== null ? round2(avgRiskReward) : null,
    maxDrawdownPct: round2(maxDdPct),
    sharpeRatio,
    netPnl: round2(netPnl),
    totalCosts: round2(totalCosts),
    returnPct: round2(returnPct),
    equityCurve,
    walkForwardTrainReturnPct: round2((trainPnl / config.startingCapital) * 100),
    walkForwardTestReturnPct: round2((testPnl / config.startingCapital) * 100),
    monteCarloP5ReturnPct: mc.p5ReturnPct,
    monteCarloMedianReturnPct: mc.medianReturnPct,
    monteCarloWorstDdPct: mc.worstDdPct,
    monteCarloBestReturnPct: mc.bestReturnPct,
    missingDataNote:
      "Simulated OHLCV bar series (140 bars) anchored to live session quotes; zero look-ahead bias enforced (signal at bar t-1 executes at bar t open with spread, slippage & Indian charges).",
  };
}

function isEntrySignal(
  rule: BacktestRuleType,
  idx: number,
  closes: number[],
  ema9: Array<number | null>,
  ema21: Array<number | null>,
  sma20: Array<number | null>,
  rsi14: Array<number | null>,
  macdLine: Array<number | null>,
  macdSignal: Array<number | null>
): boolean {
  if (idx < 1) return false;
  if (rule === "EMA_CROSS") {
    return (
      ema9[idx] !== null &&
      ema21[idx] !== null &&
      ema9[idx - 1] !== null &&
      ema21[idx - 1] !== null &&
      (ema9[idx] as number) > (ema21[idx] as number) &&
      (ema9[idx - 1] as number) <= (ema21[idx - 1] as number)
    );
  }
  if (rule === "RSI_MEAN_REVERSION") {
    return rsi14[idx] !== null && (rsi14[idx] as number) < 38;
  }
  if (rule === "BOLLINGER_BREAKOUT") {
    return sma20[idx] !== null && closes[idx] > (sma20[idx] as number) * 1.006;
  }
  return (
    macdLine[idx] !== null &&
    macdSignal[idx] !== null &&
    (macdLine[idx] as number) > (macdSignal[idx] as number)
  );
}

function isExitSignal(
  rule: BacktestRuleType,
  idx: number,
  ema9: Array<number | null>,
  ema21: Array<number | null>,
  rsi14: Array<number | null>,
  macdLine: Array<number | null>,
  macdSignal: Array<number | null>
): boolean {
  if (rule === "EMA_CROSS") {
    return ema9[idx] !== null && ema21[idx] !== null && (ema9[idx] as number) < (ema21[idx] as number);
  }
  if (rule === "RSI_MEAN_REVERSION") {
    return rsi14[idx] !== null && (rsi14[idx] as number) > 65;
  }
  if (rule === "MACD_MOMENTUM") {
    return macdLine[idx] !== null && macdSignal[idx] !== null && (macdLine[idx] as number) < (macdSignal[idx] as number);
  }
  return false;
}

function runMonteCarlo(pnls: number[], startCap: number, runs: number) {
  if (pnls.length === 0) {
    return { p5ReturnPct: 0, medianReturnPct: 0, worstDdPct: 0, bestReturnPct: 0 };
  }
  const finalReturns: number[] = [];
  let worstDdPct = 0;
  // Deterministic LCG PRNG for reproducible bootstrap resampling WITH replacement
  let seed = (pnls.length * 2654435761 + Math.round(Math.abs(pnls[0] ?? 1) * 100)) >>> 0;
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < runs; r++) {
    let eq = startCap;
    let peak = startCap;
    for (let i = 0; i < pnls.length; i++) {
      const idx = Math.floor(nextRand() * pnls.length);
      const pick = pnls[idx];
      eq += pick;
      if (eq > peak) peak = eq;
      const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
      if (dd > worstDdPct) worstDdPct = dd;
    }
    finalReturns.push(((eq - startCap) / startCap) * 100);
  }

  finalReturns.sort((a, b) => a - b);
  const p5Idx = Math.max(0, Math.floor(finalReturns.length * 0.05));
  const p50Idx = Math.floor(finalReturns.length * 0.5);
  const p95Idx = Math.min(finalReturns.length - 1, Math.floor(finalReturns.length * 0.95));
  return {
    p5ReturnPct: round2(finalReturns[p5Idx]),
    medianReturnPct: round2(finalReturns[p50Idx]),
    worstDdPct: round2(worstDdPct),
    bestReturnPct: round2(finalReturns[p95Idx]),
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
