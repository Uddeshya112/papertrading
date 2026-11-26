"use client";

import { useMemo, useState } from "react";
import {
  calculatePositionSize,
  calculateRoundTripCharges,
  getIndianTaxClassification,
  type BrokeragePlan,
  type ProductType,
} from "@/lib/indian-charges";
import { SEGMENT_LABELS, type MarketSegment } from "@/lib/paper-instruments";

export function CalculatorsTaxView({
  defaultCapital,
  defaultBrokeragePlan,
}: {
  defaultCapital: number;
  defaultBrokeragePlan: BrokeragePlan;
}) {
  // Position Sizing state (defaults to Rohit's Flattrade example)
  const [capital, setCapital] = useState(defaultCapital || 500000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(2200);
  const [stopLoss, setStopLoss] = useState(2165);
  const [target, setTarget] = useState(2255);
  const [lotSize, setLotSize] = useState(1);
  const [segment, setSegment] = useState<MarketSegment>("NSE_EQUITY");
  const [product, setProduct] = useState<ProductType>("INTRADAY");
  const [brokeragePlan, setBrokeragePlan] = useState<BrokeragePlan>(defaultBrokeragePlan);

  // Expectancy Simulator state (defaults to Rohit's weekly journal from Flattrade guide)
  const [winRate, setWinRate] = useState(62.5);
  const [avgWin, setAvgWin] = useState(6800);
  const [avgLoss, setAvgLoss] = useState(3900);
  const [sampleTrades, setSampleTrades] = useState(50);

  const posResult = useMemo(
    () =>
      calculatePositionSize({
        capital,
        riskPercent: riskPct,
        entryPrice: entry,
        stopLossPrice: stopLoss,
        targetPrice: target,
        lotSize: Math.max(1, lotSize),
        segment,
        product,
        brokeragePlan,
      }),
    [capital, riskPct, entry, stopLoss, target, lotSize, segment, product, brokeragePlan]
  );

  const charges = useMemo(
    () =>
      calculateRoundTripCharges({
        segment,
        product,
        buyPrice: Math.min(entry, target),
        sellPrice: Math.max(entry, target),
        quantity: Math.max(1, posResult.recommendedUnits || lotSize),
        brokeragePlan,
      }),
    [segment, product, entry, target, posResult.recommendedUnits, lotSize, brokeragePlan]
  );

  const taxInfo = getIndianTaxClassification(segment, product);

  const expectancyPerTrade = Number(
    ((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss).toFixed(2)
  );
  const projectedSeriesPnl = Number((expectancyPerTrade * sampleTrades).toFixed(2));

  function loadRohitPreset() {
    setCapital(500000);
    setRiskPct(1);
    setEntry(2200);
    setStopLoss(2165);
    setTarget(2255);
    setLotSize(1);
    setSegment("NSE_EQUITY");
    setProduct("INTRADAY");
  }

  return (
    <div className="nt-stack">
      <div className="dashboard-grid">
        {/* Position Sizing & Breakeven Calculator */}
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">RISK MANAGEMENT CALCULATOR</span>
              <h2>Position Sizing &amp; Risk-Reward</h2>
            </div>
            <button type="button" className="nt-pill" onClick={loadRohitPreset}>
              Load Rohit&apos;s ₹5L Example
            </button>
          </div>

          <div className="nt-calc-form">
            <label>
              Account Capital (₹)
              <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} />
            </label>
            <label>
              Risk per Trade (%)
              <input type="number" step="0.25" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 0)} />
            </label>
            <label>
              Entry Price (₹)
              <input type="number" step="0.05" value={entry} onChange={(e) => setEntry(Number(e.target.value) || 0)} />
            </label>
            <label>
              Stop-Loss Price (₹)
              <input type="number" step="0.05" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value) || 0)} />
            </label>
            <label>
              Target Price (₹)
              <input type="number" step="0.05" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} />
            </label>
            <label>
              Lot Size (1 for cash equity)
              <input type="number" min={1} value={lotSize} onChange={(e) => setLotSize(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>
              Market Segment
              <select value={segment} onChange={(e) => setSegment(e.target.value as MarketSegment)}>
                {(Object.keys(SEGMENT_LABELS) as MarketSegment[]).map((k) => (
                  <option key={k} value={k}>{SEGMENT_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label>
              Product &amp; Brokerage
              <div className="nt-inline-actions">
                <select value={product} onChange={(e) => setProduct(e.target.value as ProductType)}>
                  <option value="INTRADAY">Intraday</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="NRML">NRML (F&amp;O)</option>
                </select>
                <select value={brokeragePlan} onChange={(e) => setBrokeragePlan(e.target.value as BrokeragePlan)}>
                  <option value="ZERO_BROKERAGE">₹0 Brokerage</option>
                  <option value="FLAT_20">₹20 / order</option>
                </select>
              </div>
            </label>
          </div>

          <div className="nt-calc-results">
            <div><span>Max Risk (₹)</span><strong>₹{posResult.riskAmount.toLocaleString("en-IN")}</strong></div>
            <div><span>Recommended Qty</span><strong>{posResult.recommendedUnits} units ({posResult.recommendedLots} lots)</strong></div>
            <div><span>Risk : Reward</span><strong>1 : {posResult.riskRewardRatio}</strong></div>
            <div><span>Notional Exposure</span><strong>₹{posResult.notionalExposure.toLocaleString("en-IN")} ({posResult.exposurePercent}%)</strong></div>
            <div><span>Projected Gross Profit</span><strong className="nt-pos">₹{posResult.projectedGrossProfit.toLocaleString("en-IN")}</strong></div>
            <div><span>Projected Net Profit</span><strong className="nt-pos">₹{posResult.projectedNetProfit.toLocaleString("en-IN")}</strong></div>
          </div>
        </section>

        {/* Indian Transaction Cost & Breakeven Breakdown */}
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">INDIAN COST STRUCTURE</span>
              <h2>Round-Trip Charges &amp; Breakeven</h2>
            </div>
            <span className="source-tag">Min Profitable Trade</span>
          </div>

          <div className="nt-cost-table">
            <div><span>Total Round-Trip Turnover</span><strong>₹{charges.turnover.toLocaleString("en-IN")}</strong></div>
            <div><span>Brokerage ({brokeragePlan === "ZERO_BROKERAGE" ? "₹0 Plan" : "₹20/Order"})</span><strong>₹{charges.brokerage.toFixed(2)}</strong></div>
            <div><span>{charges.sttLabel} (Securities / Commodities Txn Tax)</span><strong>₹{charges.sttOrCtt.toFixed(2)}</strong></div>
            <div><span>Exchange Transaction Charges</span><strong>₹{charges.exchangeCharges.toFixed(2)}</strong></div>
            <div><span>SEBI Turnover Fees</span><strong>₹{charges.sebiFees.toFixed(2)}</strong></div>
            <div><span>Stamp Duty (Buy side)</span><strong>₹{charges.stampDuty.toFixed(2)}</strong></div>
            <div><span>GST (18% on Brokerage + Exchange + SEBI)</span><strong>₹{charges.gst.toFixed(2)}</strong></div>
            <div className="nt-cost-total">
              <span>Minimum Profitable Trade (Total Cost)</span>
              <strong>₹{charges.totalCharges.toFixed(2)}</strong>
            </div>
            <div>
              <span>Breakeven Move Needed</span>
              <strong>₹{charges.breakevenPointsPerUnit.toFixed(2)} / unit</strong>
            </div>
          </div>

          <div className="nt-tax-box">
            <span className="card-kicker">INDIAN LIVE TAX CATEGORY ({SEGMENT_LABELS[segment]})</span>
            <h3>{taxInfo.category}</h3>
            <p>{taxInfo.lossSetOff}</p>
            <small>{taxInfo.note}</small>
          </div>
        </section>
      </div>

      {/* Expectancy Formula Simulator */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">STRATEGY EDGE FORMULA</span>
            <h2>Expectancy per Trade Simulator</h2>
            <p>Formula: Expectancy = (Win Rate × Average Win) − (Loss Rate × Average Loss)</p>
          </div>
          <span className="source-tag">
            {expectancyPerTrade > 0 ? "Positive Edge" : "Negative / Zero Edge"}
          </span>
        </div>

        <div className="nt-calc-form four-col">
          <label>
            Win Rate (%)
            <input type="number" min={0} max={100} step="0.5" value={winRate} onChange={(e) => setWinRate(Number(e.target.value) || 0)} />
          </label>
          <label>
            Average Winning Trade (₹)
            <input type="number" min={0} value={avgWin} onChange={(e) => setAvgWin(Number(e.target.value) || 0)} />
          </label>
          <label>
            Average Losing Trade (₹)
            <input type="number" min={0} value={avgLoss} onChange={(e) => setAvgLoss(Number(e.target.value) || 0)} />
          </label>
          <label>
            Sample Size (Trades)
            <input type="number" min={1} value={sampleTrades} onChange={(e) => setSampleTrades(Math.max(1, Number(e.target.value) || 1))} />
          </label>
        </div>

        <div className="nt-cost-preview" style={{ marginTop: 14 }}>
          <div>
            <span>Expectancy per Trade</span>
            <strong className={expectancyPerTrade >= 0 ? "nt-pos" : "nt-neg"}>
              {expectancyPerTrade >= 0 ? "+" : ""}₹{expectancyPerTrade.toLocaleString("en-IN")}
            </strong>
          </div>
          <div>
            <span>Projected Net Edge over {sampleTrades} Trades</span>
            <strong className={projectedSeriesPnl >= 0 ? "nt-pos" : "nt-neg"}>
              {projectedSeriesPnl >= 0 ? "+" : ""}₹{projectedSeriesPnl.toLocaleString("en-IN")}
            </strong>
          </div>
          <div>
            <span>Loss Rate</span>
            <strong>{(100 - winRate).toFixed(1)}%</strong>
          </div>
        </div>
      </section>

      {/* SEBI Derivatives Risk Disclosure (from Flattrade Learn) */}
      <article className="truth-card">
        <span className="truth-icon">!</span>
        <div>
          <strong>SEBI Risk Disclosure on Equity Derivatives (SEBI Study, Jan 25, 2023)</strong>
          <p>
            9 out of 10 individual traders in the equity Futures &amp; Options segment incurred net losses, averaging close to ₹50,000 in net trading losses plus an additional 28% in transaction costs. Even profitable traders spent 15%–50% of profits on transaction costs. Always consult the latest Finance Act and a qualified Chartered Accountant before filing live trading taxes.
          </p>
        </div>
      </article>
    </div>
  );
}
