"use client";

import { useMemo, useState } from "react";
import { computeAnalytics, exportJournalToCsv, type EquityPoint } from "@/lib/analytics";
import { STRATEGY_TAGS, type PaperAccountState } from "@/lib/paper-engine";
import { REGIME_META } from "@/lib/paper-instruments";
import { formatINR, plural } from "@/lib/format";

type Props = {
  account: PaperAccountState;
  onUpdateReflection: (tradeId: string, reflection: string) => void;
  onLoadRohitExample: () => void;
  onTogglePrerequisite: (key: keyof PaperAccountState["prerequisites"]) => void;
};

export function JournalAnalyticsView({
  account,
  onUpdateReflection,
  onLoadRohitExample,
  onTogglePrerequisite,
}: Props) {
  const [strategyFilter, setStrategyFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");

  const stats = useMemo(() => computeAnalytics(account), [account]);

  const dayWiseSummary = useMemo(() => {
    const map = new Map<string, { date: string; trades: number; wins: number; gross: number; charges: number; net: number }>();
    for (const t of account.journal) {
      const date = t.closedAt.slice(0, 10);
      const cur = map.get(date) ?? { date, trades: 0, wins: 0, gross: 0, charges: 0, net: 0 };
      cur.trades += 1;
      if (t.netPnl >= 0) cur.wins += 1;
      cur.gross += t.grossPnl;
      cur.charges += t.charges;
      cur.net += t.netPnl;
      map.set(date, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [account.journal]);

  const filteredJournal = useMemo(() => {
    return account.journal.filter((t) => {
      if (strategyFilter !== "ALL" && t.strategy !== strategyFilter) return false;
      if (outcomeFilter === "WIN" && t.netPnl < 0) return false;
      if (outcomeFilter === "LOSS" && t.netPnl >= 0) return false;
      return true;
    });
  }, [account.journal, strategyFilter, outcomeFilter]);

  function downloadCsv() {
    const csv = exportJournalToCsv(account.journal);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nextrade-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="nt-stack">
      {/* Analytics KPI Row */}
      <div className="nt-kpi-grid">
        <div className="surface-card nt-kpi">
          <span className="card-kicker">EXPECTANCY PER TRADE</span>
          <strong className={stats.expectancyPerTrade >= 0 ? "nt-pos" : "nt-neg"}>
            {formatINR(stats.expectancyPerTrade, { signed: true })}
          </strong>
          <small>(Win% × AvgWin) − (Loss% × AvgLoss)</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">WIN RATE / PROFIT FACTOR</span>
          <strong>{stats.winRate.toFixed(1)}% · PF {stats.profitFactor}</strong>
          <small>{stats.wins}W / {stats.losses}L across {plural(stats.totalTrades, "trade")}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">MAX DRAWDOWN</span>
          <strong className={stats.maxDrawdownPercent > 10 ? "nt-neg" : ""}>
            {stats.maxDrawdownPercent.toFixed(2)}%
          </strong>
          <small>{formatINR(stats.maxDrawdownAmount)} peak-to-trough</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">GO-LIVE READINESS</span>
          <strong>{stats.readinessScore}%</strong>
          <small>Target: 50+ trades &amp; positive net edge</small>
        </div>
      </div>

      {/* Equity Curve + Go-Live Readiness */}
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">PERFORMANCE BASELINE</span>
              <h2>Virtual Equity Curve</h2>
            </div>
            <button type="button" className="nt-pill" onClick={onLoadRohitExample}>
              + Load Flattrade Example Trade
            </button>
          </div>
          <EquityCurveChart points={stats.equityCurve} startingCapital={account.startingCapital} />
          <div className="nt-cost-preview" style={{ marginTop: 12 }}>
            <div><span>Gross P&amp;L</span><strong>{formatINR(stats.grossPnl, { signed: true })}</strong></div>
            <div><span>Simulated Indian Charges</span><strong>{formatINR(-Math.abs(stats.totalCharges))}</strong></div>
            <div><span>Net P&amp;L ({stats.returnPercent}%)</span><strong className={stats.netPnl >= 0 ? "nt-pos" : "nt-neg"}>{formatINR(stats.netPnl, { signed: true })}</strong></div>
          </div>
        </section>

        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">RESPONSIBLE TRANSITION ROADMAP</span>
              <h2>Go-Live Benchmarks</h2>
            </div>
            <span className="source-tag">{stats.readinessScore}% Ready</span>
          </div>

          <div className="nt-check-list">
            {stats.goLiveChecks.map((check) => (
              <div key={check.id} className={`nt-check-item${check.passed ? " passed" : ""}`}>
                <span className="nt-check-dot">{check.passed ? "✓" : "○"}</span>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
                <span className="source-tag">{check.progressText}</span>
              </div>
            ))}
          </div>

          <div className="nt-live-prereq">
            <span className="card-kicker">LIVE INDIAN ACCOUNT PREREQUISITES &amp; 10–20% INITIAL ALLOCATION</span>
            <p className="nt-muted-sm">
              Recommended initial live capital: <strong>₹{stats.recommendedInitialLiveCapitalMin.toLocaleString("en-IN")} – ₹{stats.recommendedInitialLiveCapitalMax.toLocaleString("en-IN")}</strong> (10–20% of your ₹{account.startingCapital.toLocaleString("en-IN")} virtual capital).
            </p>
            <div className="nt-prereq-grid">
              {[
                ["dematAccount", "NSDL / CDSL Demat Account"],
                ["sebiBroker", "SEBI-Registered Broker"],
                ["linkedBank", "Linked Bank Account"],
                ["kycComplete", "KYC Completed"],
                ["derivativesIncomeProof", "F&O Income Proof & Risk Profile"],
              ].map(([key, label]) => {
                const k = key as keyof PaperAccountState["prerequisites"];
                return (
                  <label key={key} className="nt-checkbox-label">
                    <input
                      type="checkbox"
                      checked={account.prerequisites[k]}
                      onChange={() => onTogglePrerequisite(k)}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Day-Wise P&L Report */}
      {dayWiseSummary.length > 0 && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">DAY-WISE TRADING REPORT</span>
              <h2>Daily P&amp;L, Charges &amp; Win Rate Summary</h2>
            </div>
            <span className="source-tag">{dayWiseSummary.length} trading day(s)</span>
          </div>
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Gross P&amp;L</th>
                  <th>Taxes &amp; Charges</th>
                  <th>Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {dayWiseSummary.map((d) => (
                  <tr key={d.date}>
                    <th scope="row"><strong>{d.date}</strong></th>
                    <td>{d.trades}</td>
                    <td>{((d.wins / d.trades) * 100).toFixed(0)}%</td>
                    <td>{formatINR(d.gross, { signed: true })}</td>
                    <td>{formatINR(-Math.abs(d.charges))}</td>
                    <td className={d.net >= 0 ? "nt-pos" : "nt-neg"}>
                      <strong>{formatINR(d.net, { signed: true })}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Strategy Breakdown */}
      {stats.strategyBreakdown.length > 0 && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">EDGE BY SETUP</span>
              <h2>Strategy Performance Breakdown</h2>
            </div>
          </div>
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Expectancy / Trade</th>
                  <th>Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {stats.strategyBreakdown.map((row) => (
                  <tr key={row.strategy}>
                    <th scope="row"><strong>{row.strategy}</strong></th>
                    <td>{row.trades}</td>
                    <td>{row.winRate.toFixed(1)}%</td>
                    <td className={row.expectancy >= 0 ? "nt-pos" : "nt-neg"}>{formatINR(row.expectancy, { signed: true })}</td>
                    <td className={row.netPnl >= 0 ? "nt-pos" : "nt-neg"}><strong>{formatINR(row.netPnl, { signed: true })}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Trade Journal */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">TRADE JOURNAL &amp; EMOTIONAL PATTERNS</span>
            <h2>Closed Trades ({filteredJournal.length})</h2>
          </div>
          <div className="nt-inline-actions">
            <select
              className="nt-select-sm"
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
            >
              <option value="ALL">All Strategies</option>
              {STRATEGY_TAGS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="nt-select-sm"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as "ALL" | "WIN" | "LOSS")}
            >
              <option value="ALL">All Outcomes</option>
              <option value="WIN">Winners Only</option>
              <option value="LOSS">Losers Only</option>
            </select>
            <button type="button" className="nt-pill" onClick={downloadCsv} disabled={account.journal.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        {filteredJournal.length === 0 ? (
          <p className="market-api-muted">
            No closed trades yet. Close an open position or click “+ Load Flattrade Example Trade” above to test the journal and expectancy engine.
          </p>
        ) : (
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Entry → Exit</th>
                  <th>Strategy / Regime</th>
                  <th>Emotion</th>
                  <th>Gross / Charges</th>
                  <th>Net P&amp;L</th>
                  <th>Post-Trade Reflection</th>
                </tr>
              </thead>
              <tbody>
                {filteredJournal.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">
                      <strong>{t.symbol}</strong>
                      <small>{t.side} {t.quantity} · {t.exitReason.replaceAll("_", " ")}</small>
                    </th>
                    <td>₹{t.entryPrice} → ₹{t.exitPrice}</td>
                    <td>
                      <strong>{t.strategy}</strong>
                      <small>{REGIME_META[t.regime].label}</small>
                    </td>
                    <td><span className="source-tag">{t.emotion}</span></td>
                    <td>{formatINR(t.grossPnl, { signed: true })}<small>{formatINR(-Math.abs(t.charges))}</small></td>
                    <td className={t.netPnl >= 0 ? "nt-pos" : "nt-neg"}>
                      <strong>{formatINR(t.netPnl, { signed: true })}</strong>
                    </td>
                    <td>
                      <textarea rows={2} style={{ width: "100%", minWidth: 200, resize: "vertical", padding: "6px 8px", fontSize: 12, lineHeight: 1.4 }} className="nt-input-sm"
                        style={{ minWidth: 180 }}
                        value={t.reflection}
                        onChange={(e) => onUpdateReflection(t.id, e.target.value)}
                        placeholder="What worked or broke discipline?"
                      / />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EquityCurveChart({ points, startingCapital }: { points: EquityPoint[]; startingCapital: number }) {
  const width = 560;
  const height = 190;
  const pad = 24;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values, startingCapital * 0.99);
  const max = Math.max(...values, startingCapital * 1.01);
  const span = Math.max(max - min, 1);

  const toX = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2);
  const toY = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const poly = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.equity).toFixed(1)}`).join(" ");
  const isUp = (values[values.length - 1] ?? startingCapital) >= startingCapital;

  return (
    <div className="nt-svg-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="nt-svg-chart">
        <line
          x1={pad}
          y1={toY(startingCapital)}
          x2={width - pad}
          y2={toY(startingCapital)}
          stroke="#cfd8d1"
          strokeDasharray="4 4"
        />
        <polyline
          points={poly}
          fill="none"
          stroke={isUp ? "#17613f" : "#b84739"}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={p.tradeIndex} cx={toX(i)} cy={toY(p.equity)} r="3" fill={isUp ? "#17613f" : "#b84739"}>
            <title>{`${p.label}: ₹${p.equity.toLocaleString("en-IN")} (DD ${p.drawdownPercent}%)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
