"use client";

import { useMemo, useState } from "react";
import { computeAnalytics } from "@/lib/analytics";
import { calculatePositionSize } from "@/lib/indian-charges";
import {
  computePositionPnl,
  type PaperAccountState,
  type RiskLimitsConfig,
} from "@/lib/paper-engine";
import { getInstrumentById, type LiveQuote } from "@/lib/paper-instruments";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  onUpdateRiskLimits: (limits: RiskLimitsConfig) => void;
};

export function RiskCenterView({ account, quotes, onUpdateRiskLimits }: Props) {
  const stats = useMemo(() => computeAnalytics(account), [account]);

  // Quick 5-in-1 Risk Calculator state
  const [entry, setEntry] = useState(2200);
  const [sl, setSl] = useState(2165);
  const [target, setTarget] = useState(2270);
  const [riskPct, setRiskPct] = useState(account.riskLimits.maxRiskPerTradePct || 1);

  // Risk of Ruin educational simulator inputs
  const [rorWinRate, setRorWinRate] = useState(50);
  const [rorPayoff, setRorPayoff] = useState(1.5);
  const [rorRiskPerTrade, setRorRiskPerTrade] = useState(2);

  const calc = useMemo(
    () =>
      calculatePositionSize({
        capital: account.startingCapital,
        riskPercent: riskPct,
        entryPrice: entry,
        stopLossPrice: sl,
        targetPrice: target,
        lotSize: 1,
        segment: "NSE_EQUITY",
        product: "INTRADAY",
        brokeragePlan: account.brokeragePlan,
      }),
    [account.startingCapital, account.brokeragePlan, riskPct, entry, sl, target]
  );

  // Live portfolio risk metrics
  const usedMargin = account.positions.reduce((s, p) => s + p.marginBlocked, 0);
  const unrealized = account.positions.reduce(
    (s, p) => s + computePositionPnl(p, quotes[p.instrumentId]?.last ?? p.entryPrice),
    0
  );
  const totalEquity = account.availableCash + usedMargin + unrealized;
  const marginUtilPct = totalEquity > 0 ? (usedMargin / totalEquity) * 100 : 0;

  // Sector Exposure & Concentration Risk
  const sectorExposure = useMemo(() => {
    const map = new Map<string, number>();
    let totalNotional = 0;
    for (const p of account.positions) {
      const inst = getInstrumentById(p.instrumentId);
      const notional = p.entryPrice * p.quantity;
      totalNotional += notional;
      map.set(inst.sector, (map.get(inst.sector) ?? 0) + notional);
    }
    return Array.from(map.entries())
      .map(([sector, notional]) => ({
        sector,
        notional,
        pct: totalNotional > 0 ? (notional / totalNotional) * 100 : 0,
      }))
      .sort((a, b) => b.notional - a.notional);
  }, [account.positions]);

  // Consecutive Loss Counter
  let consecutiveLosses = 0;
  for (const t of account.journal) {
    if (t.netPnl < 0) consecutiveLosses++;
    else break;
  }

  // Daily Loss Check
  const todayIso = new Date().toISOString().slice(0, 10);
  const dailyRealized = account.journal
    .filter((t) => t.closedAt.startsWith(todayIso))
    .reduce((s, t) => s + t.netPnl, 0);
  const dailyTotal = dailyRealized + unrealized;

  // Educational Risk of Ruin (approximate gambler's ruin / edge formula for 50% drawdown)
  const riskOfRuinPct = useMemo(() => {
    const p = rorWinRate / 100;
    const q = 1 - p;
    const edge = p * rorPayoff - q;
    if (edge <= 0) return 99.9;
    const unitsToHalf = Math.max(1, 50 / Math.max(0.25, rorRiskPerTrade));
    const ratio = (1 - edge) / (1 + edge);
    return Number(Math.min(99.9, Math.max(0.1, Math.pow(Math.max(0, ratio), unitsToHalf) * 100)).toFixed(1));
  }, [rorWinRate, rorPayoff, rorRiskPerTrade]);

  const capitalProtectionScore = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        100 -
          stats.maxDrawdownPercent * 3 -
          (consecutiveLosses >= account.riskLimits.maxConsecutiveLosses ? 20 : 0) -
          (marginUtilPct > 70 ? 15 : 0)
      )
    )
  );

  return (
    <div className="nt-stack">
      {/* Top Risk KPIs */}
      <div className="nt-kpi-grid">
        <div className="surface-card nt-kpi">
          <span className="card-kicker">CAPITAL PROTECTION SCORE</span>
          <strong className={capitalProtectionScore >= 75 ? "nt-pos" : "nt-neg"}>
            {capitalProtectionScore}/100
          </strong>
          <small>Based on actual drawdown, margin &amp; streak</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">DAILY P&amp;L vs LIMIT</span>
          <strong className={dailyTotal >= 0 ? "nt-pos" : "nt-neg"}>
            {dailyTotal >= 0 ? "+" : ""}₹{dailyTotal.toFixed(0)}
          </strong>
          <small>Max Daily Loss Limit: −₹{account.riskLimits.maxDailyLossAmount.toLocaleString("en-IN")}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">MARGIN UTILIZATION</span>
          <strong>{marginUtilPct.toFixed(1)}%</strong>
          <small>₹{Math.round(usedMargin).toLocaleString("en-IN")} used / ₹{Math.round(totalEquity).toLocaleString("en-IN")}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">CONSECUTIVE LOSSES</span>
          <strong className={consecutiveLosses >= account.riskLimits.maxConsecutiveLosses ? "nt-neg" : ""}>
            {consecutiveLosses} / {account.riskLimits.maxConsecutiveLosses}
          </strong>
          <small>Max Drawdown: {stats.maxDrawdownPercent.toFixed(2)}%</small>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Personal Risk Limits Config */}
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">PERSONAL RISK GUARDRAILS</span>
              <h2>Configure Your Risk Limits</h2>
            </div>
          </div>
          <div className="nt-calc-form">
            <label>
              Max Risk Per Trade (%)
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="10"
                value={account.riskLimits.maxRiskPerTradePct}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxRiskPerTradePct: Number(e.target.value) || 1 })
                }
              />
            </label>
            <label>
              Max Daily Loss (₹)
              <input
                type="number"
                step="1000"
                value={account.riskLimits.maxDailyLossAmount}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxDailyLossAmount: Number(e.target.value) || 10000 })
                }
              />
            </label>
            <label>
              Max Drawdown (%)
              <input
                type="number"
                min="2"
                max="50"
                value={account.riskLimits.maxDrawdownPct}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxDrawdownPct: Number(e.target.value) || 10 })
                }
              />
            </label>
            <label>
              Max Consecutive Losses
              <input
                type="number"
                min="1"
                max="10"
                value={account.riskLimits.maxConsecutiveLosses}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxConsecutiveLosses: Number(e.target.value) || 3 })
                }
              />
            </label>
            <label>
              Max Open Positions
              <input
                type="number"
                min="1"
                max="20"
                value={account.riskLimits.maxOpenPositions}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxOpenPositions: Number(e.target.value) || 6 })
                }
              />
            </label>
            <label>
              Max Sector Exposure (%)
              <input
                type="number"
                min="10"
                max="100"
                value={account.riskLimits.maxSectorExposurePct}
                onChange={(e) =>
                  onUpdateRiskLimits({ ...account.riskLimits, maxSectorExposurePct: Number(e.target.value) || 35 })
                }
              />
            </label>
          </div>
        </section>

        {/* Risk of Ruin Educational Simulator */}
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">EDUCATIONAL SIMULATOR</span>
              <h2>Risk of Ruin (50% Drawdown Probability)</h2>
            </div>
            <span className={`nt-badge ${riskOfRuinPct > 15 ? "sell" : "buy"}`}>
              {riskOfRuinPct}% Risk
            </span>
          </div>
          <div className="nt-calc-form">
            <label>
              Win Rate (%)
              <input type="number" min="10" max="90" value={rorWinRate} onChange={(e) => setRorWinRate(Number(e.target.value) || 40)} />
            </label>
            <label>
              Avg Reward : Risk (e.g. 1.5)
              <input type="number" step="0.1" min="0.5" value={rorPayoff} onChange={(e) => setRorPayoff(Number(e.target.value) || 1)} />
            </label>
            <label>
              Risk Per Trade (%)
              <input type="number" step="0.5" min="0.5" max="20" value={rorRiskPerTrade} onChange={(e) => setRorRiskPerTrade(Number(e.target.value) || 1)} />
            </label>
            <div className="nt-step-card">
              <strong>Why it matters</strong>
              <p>Even a profitable strategy can blow up if you risk 10% per trade. Dropping risk to 1%–2% pushes Risk of Ruin near 0%.</p>
            </div>
          </div>
        </section>
      </div>

      {/* 5-in-1 Position Size / Stop-Loss / Target / R:R Calculator */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">VERIFIED FORMULA SUITE</span>
            <h2>Position Size, Stop-Loss, Target &amp; Risk/Reward Calculator</h2>
          </div>
        </div>
        <div className="nt-calc-form four-col">
          <label>Entry Price (₹)<input type="number" value={entry} onChange={(e) => setEntry(Number(e.target.value) || 0)} /></label>
          <label>Stop-Loss (₹)<input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value) || 0)} /></label>
          <label>Target Price (₹)<input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} /></label>
          <label>Risk Per Trade (%)<input type="number" step="0.25" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 1)} /></label>
        </div>
        <div className="nt-calc-results">
          <div><span>Max Rupee Risk</span><strong>₹{calc.riskAmount.toLocaleString("en-IN")}</strong></div>
          <div><span>Exact Share Quantity</span><strong>{calc.recommendedUnits} shares</strong></div>
          <div><span>Risk : Reward</span><strong>1 : {calc.riskRewardRatio}</strong></div>
          <div><span>Stop Distance</span><strong>₹{calc.stopDistance} / share</strong></div>
          <div><span>Target Distance</span><strong>₹{calc.rewardDistance} / share</strong></div>
          <div><span>Net Projected Profit</span><strong className="nt-pos">₹{calc.projectedNetProfit.toLocaleString("en-IN")}</strong></div>
        </div>
      </section>

      {/* Sector Exposure & Concentration Risk Heatmap */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">CONCENTRATION &amp; CORRELATION HEATMAP</span>
            <h2>Live Portfolio Sector Exposure</h2>
          </div>
        </div>
        {sectorExposure.length === 0 ? (
          <p className="market-api-muted">No open positions right now. Open positions will display live sector concentration and breach warnings here.</p>
        ) : (
          <div className="nt-sector-grid">
            {sectorExposure.map((s) => {
              const breached = s.pct > account.riskLimits.maxSectorExposurePct;
              return (
                <div key={s.sector} className="nt-sector-card" style={{ borderColor: breached ? "#b84739" : "#d8e7dc" }}>
                  <span>{s.sector}</span>
                  <strong className={breached ? "nt-neg" : "nt-pos"}>{s.pct.toFixed(1)}%</strong>
                  <small>₹{Math.round(s.notional).toLocaleString("en-IN")}{breached ? " · Limit Exceeded!" : ""}</small>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
