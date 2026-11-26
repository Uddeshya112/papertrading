"use client";

import { useMemo, useState } from "react";
import {
  runHistoricalBacktest,
  type BacktestConfig,
  type BacktestResult,
  type BacktestRuleType,
} from "@/lib/backtest-engine";
import { CHART_TIMEFRAMES, type ChartTimeframe } from "@/lib/candlestick-engine";
import { formatINR } from "@/lib/format";
import type { PaperAccountState } from "@/lib/paper-engine";
import { PAPER_INSTRUMENTS, type LiveQuote } from "@/lib/paper-instruments";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
};

export function BacktestLabView({ account, quotes }: Props) {
  const [name, setName] = useState("EMA 9/21 Momentum");
  const [instrumentId, setInstrumentId] = useState(PAPER_INSTRUMENTS[0].id);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [rule, setRule] = useState<BacktestRuleType>("EMA_CROSS");
  const [riskPct, setRiskPct] = useState(1);
  const [slPct, setSlPct] = useState(1.5);
  const [tgtPct, setTgtPct] = useState(3.0);
  const [slippageBps, setSlippageBps] = useState(5);
  const [savedResults, setSavedResults] = useState<BacktestResult[]>([]);
  const [replayIndex, setReplayIndex] = useState(40);

  const config: BacktestConfig = useMemo(
    () => ({
      id: `BT-${rule}-${instrumentId}-${timeframe}`,
      name,
      instrumentId,
      timeframe,
      rule,
      startingCapital: account.startingCapital,
      riskPerTradePct: riskPct,
      stopLossPct: slPct,
      targetPct: tgtPct,
      slippageBps,
      brokeragePlan: account.brokeragePlan,
    }),
    [name, instrumentId, timeframe, rule, account.startingCapital, riskPct, slPct, tgtPct, slippageBps, account.brokeragePlan]
  );

  const currentResult = useMemo(
    () => runHistoricalBacktest(config, quotes),
    [config, quotes]
  );

  function saveForComparison() {
    setSavedResults((prev) => {
      const exists = prev.some((r) => r.config.name === currentResult.config.name);
      if (exists) return prev.map((r) => (r.config.name === currentResult.config.name ? currentResult : r));
      return [currentResult, ...prev].slice(0, 6);
    });
  }

  const replayBar = currentResult.candles[Math.min(replayIndex, currentResult.candles.length - 1)];

  return (
    <div className="nt-stack">
      {/* Strategy Builder */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">ZERO LOOK-AHEAD BIAS · INDIAN COSTS &amp; SLIPPAGE INCLUDED</span>
            <h2>Strategy Builder &amp; Historical Backtesting Lab</h2>
          </div>
          <button type="button" className="primary-button" onClick={saveForComparison}>
            Save Strategy for Side-by-Side Comparison
          </button>
        </div>

        <div className="nt-calc-form four-col">
          <label>
            Strategy Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Instrument
            <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              {PAPER_INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>{i.symbol} ({i.exchange})</option>
              ))}
            </select>
          </label>
          <label>
            Timeframe
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as ChartTimeframe)}>
              {CHART_TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </label>
          <label>
            Entry / Exit Rule
            <select value={rule} onChange={(e) => setRule(e.target.value as BacktestRuleType)}>
              <option value="EMA_CROSS">EMA 9 / 21 Crossover</option>
              <option value="RSI_MEAN_REVERSION">RSI (14) Mean Reversion (&lt;38 / &gt;65)</option>
              <option value="BOLLINGER_BREAKOUT">Bollinger Upper Breakout</option>
              <option value="MACD_MOMENTUM">MACD Signal Crossover</option>
            </select>
          </label>
          <label>
            Risk Per Trade (%)
            <input type="number" step="0.25" min="0.25" max="5" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 1)} />
          </label>
          <label>
            Stop-Loss (%)
            <input type="number" step="0.25" min="0.25" max="10" value={slPct} onChange={(e) => setSlPct(Number(e.target.value) || 1.5)} />
          </label>
          <label>
            Target (%)
            <input type="number" step="0.25" min="0.5" max="20" value={tgtPct} onChange={(e) => setTgtPct(Number(e.target.value) || 3)} />
          </label>
          <label>
            Slippage (bps)
            <input type="number" min="0" max="50" value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value) || 0)} />
          </label>
        </div>

        <p className="market-api-footnote">{currentResult.missingDataNote}</p>
      </section>

      {/* Core Backtest Metrics */}
      <div className="nt-kpi-grid">
        <div className="surface-card nt-kpi">
          <span className="card-kicker">NET RETURN / P&amp;L</span>
          <strong className={currentResult.netPnl >= 0 ? "nt-pos" : "nt-neg"}>
            {currentResult.returnPct >= 0 ? "+" : ""}{currentResult.returnPct}%
          </strong>
          <small>Net {formatINR(currentResult.netPnl, { signed: true })} (Costs {formatINR(currentResult.totalCosts)})</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">WIN RATE / PROFIT FACTOR</span>
          <strong>{currentResult.winRate}% · PF {currentResult.profitFactor}</strong>
          <small>{currentResult.totalTrades} trades · Avg R:R 1:{currentResult.avgRiskReward}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">EXPECTANCY / SHARPE</span>
          <strong>{formatINR(currentResult.expectancy, { signed: true })} · SR {currentResult.sharpeRatio}</strong>
          <small>Max Drawdown: {currentResult.maxDrawdownPct}%</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">WALK-FORWARD &amp; MONTE CARLO</span>
          <strong>OOS {currentResult.walkForwardTestReturnPct}%</strong>
          <small>MC Median {currentResult.monteCarloMedianReturnPct}% · Worst DD {currentResult.monteCarloWorstDdPct}%</small>
        </div>
      </div>

      {/* Historical Chart Replay & Walk-Forward / Monte Carlo Breakdown */}
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">HISTORICAL BAR-BY-BAR REPLAY</span>
              <h2>Chart Replay Bar #{replayIndex + 1} / {currentResult.candles.length}</h2>
            </div>
            <div className="nt-inline-actions">
              <button type="button" className="nt-pill" onClick={() => setReplayIndex((i) => Math.max(10, i - 1))}>← Prev Bar</button>
              <button type="button" className="nt-pill active" onClick={() => setReplayIndex((i) => Math.min(currentResult.candles.length - 1, i + 1))}>Next Bar →</button>
            </div>
          </div>
          {replayBar && (
            <div className="nt-cost-preview" style={{ marginBottom: 10 }}>
              <div><span>Open / Close</span><strong>₹{replayBar.open} → ₹{replayBar.close}</strong></div>
              <div><span>High / Low</span><strong>₹{replayBar.high} / ₹{replayBar.low}</strong></div>
              <div><span>Bar Volume</span><strong>{replayBar.volume.toLocaleString("en-IN")}</strong></div>
            </div>
          )}
          <input
            type="range"
            min={10}
            max={Math.max(11, currentResult.candles.length - 1)}
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <p className="nt-muted-sm">
            Step forward one bar at a time without seeing future candles to practice objective breakout &amp; pullback entries.
          </p>
        </section>

        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">ROBUSTNESS VALIDATION</span>
              <h2>Walk-Forward &amp; 200-Run Monte Carlo</h2>
            </div>
          </div>
          <div className="nt-cost-table">
            <div><span>In-Sample Train Return (70%)</span><strong>{currentResult.walkForwardTrainReturnPct}%</strong></div>
            <div><span>Out-of-Sample Test Return (30%)</span><strong>{currentResult.walkForwardTestReturnPct}%</strong></div>
            <div><span>Monte Carlo Median Return (200 runs)</span><strong>{currentResult.monteCarloMedianReturnPct}%</strong></div>
            <div><span>Monte Carlo Best Case Return</span><strong className="nt-pos">{currentResult.monteCarloBestReturnPct}%</strong></div>
            <div><span>Monte Carlo Worst Drawdown</span><strong className="nt-neg">{currentResult.monteCarloWorstDdPct}%</strong></div>
          </div>
        </section>
      </div>

      {/* Side-by-Side Saved Strategy Comparison */}
      {savedResults.length > 0 && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">STRATEGY COMPARISON MATRIX</span>
              <h2>Saved Strategies ({savedResults.length})</h2>
            </div>
          </div>
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Rule / TF</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Profit Factor</th>
                  <th>Sharpe</th>
                  <th>Max DD</th>
                  <th>Net Return</th>
                </tr>
              </thead>
              <tbody>
                {savedResults.map((res) => (
                  <tr key={res.config.name}>
                    <th scope="row"><strong>{res.config.name}</strong></th>
                    <td>{res.config.rule} · {res.config.timeframe}</td>
                    <td>{res.totalTrades}</td>
                    <td>{res.winRate}%</td>
                    <td>{res.profitFactor}</td>
                    <td>{res.sharpeRatio}</td>
                    <td>{res.maxDrawdownPct}%</td>
                    <td className={res.returnPct >= 0 ? "nt-pos" : "nt-neg"}><strong>{res.returnPct}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
