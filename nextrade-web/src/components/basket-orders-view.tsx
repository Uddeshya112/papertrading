"use client";

import { useMemo, useState } from "react";
import {
  getInstrumentById,
  PAPER_INSTRUMENTS,
  type LiveQuote,
  type MarketSegment,
} from "@/lib/paper-instruments";
import type { OrderSide, PaperAccountState } from "@/lib/paper-engine";

export type BasketLegDraft = {
  instrumentId: string;
  customLabel?: string;
  side: OrderSide;
  orderType: "MARKET" | "LIMIT";
  lots: number;
  lotSize: number;
  price: number;
  segment: MarketSegment;
  stopLoss?: number;
  target?: number;
};

export type ExecutedIsoBasket = {
  id: string;
  name: string;
  mode: "ISO" | "COMB";
  basketTarget: number;
  basketStopLoss: number;
  marginBlocked: number;
  hedgeBenefitApplied: boolean;
  legs: BasketLegDraft[];
  openedAt: string;
};

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  stagedLegs: BasketLegDraft[];
  onUpdateStagedLegs: (legs: BasketLegDraft[]) => void;
  isoBaskets: ExecutedIsoBasket[];
  onExecuteBasket: (params: {
    name: string;
    mode: "ISO" | "COMB";
    basketTarget: number;
    basketStopLoss: number;
    legs: BasketLegDraft[];
    hedgeBenefitApplied: boolean;
    netMargin: number;
  }) => void;
  onExitIsoBasket: (basketId: string) => void;
};

const PRESET_STRATEGIES: Array<{
  name: string;
  bias: "Bullish" | "Bearish" | "Range-Bound" | "Equity Basket";
  summary: string;
  legs: BasketLegDraft[];
}> = [
  {
    name: "Nifty Bull Call Spread",
    bias: "Bullish",
    summary: "Defined-risk bullish spread: Buy ATM Call + Sell OTM Call.",
    legs: [
      { instrumentId: "NFO:NIFTY-24500-CE", customLabel: "NIFTY 24500 CE", side: "BUY", orderType: "MARKET", lots: 1, lotSize: 75, price: 184.5, segment: "NSE_OPTIONS" },
      { instrumentId: "NFO:NIFTY-24500-CE", customLabel: "NIFTY 24700 CE (Hedge)", side: "SELL", orderType: "MARKET", lots: 1, lotSize: 75, price: 92.0, segment: "NSE_OPTIONS" },
    ],
  },
  {
    name: "Nifty Bear Put Spread",
    bias: "Bearish",
    summary: "Defined-risk bearish spread: Buy ATM Put + Sell lower-strike Put.",
    legs: [
      { instrumentId: "NFO:NIFTY-24500-PE", customLabel: "NIFTY 24500 PE", side: "BUY", orderType: "MARKET", lots: 1, lotSize: 75, price: 158.0, segment: "NSE_OPTIONS" },
      { instrumentId: "NFO:NIFTY-24500-PE", customLabel: "NIFTY 24300 PE (Hedge)", side: "SELL", orderType: "MARKET", lots: 1, lotSize: 75, price: 78.5, segment: "NSE_OPTIONS" },
    ],
  },
  {
    name: "Nifty Iron Condor",
    bias: "Range-Bound",
    summary: "4-leg hedged theta strategy for sideways markets with capped max loss.",
    legs: [
      { instrumentId: "NFO:NIFTY-24500-CE", customLabel: "NIFTY 24650 CE", side: "SELL", orderType: "MARKET", lots: 1, lotSize: 75, price: 112.0, segment: "NSE_OPTIONS" },
      { instrumentId: "NFO:NIFTY-24500-CE", customLabel: "NIFTY 24800 CE (Wing)", side: "BUY", orderType: "MARKET", lots: 1, lotSize: 75, price: 54.0, segment: "NSE_OPTIONS" },
      { instrumentId: "NFO:NIFTY-24500-PE", customLabel: "NIFTY 24350 PE", side: "SELL", orderType: "MARKET", lots: 1, lotSize: 75, price: 105.0, segment: "NSE_OPTIONS" },
      { instrumentId: "NFO:NIFTY-24500-PE", customLabel: "NIFTY 24200 PE (Wing)", side: "BUY", orderType: "MARKET", lots: 1, lotSize: 75, price: 48.0, segment: "NSE_OPTIONS" },
    ],
  },
  {
    name: "Banking Leaders Stock Basket",
    bias: "Equity Basket",
    summary: "Equal-weighted 3-stock basket: HDFCBANK + ICICIBANK + SBIN.",
    legs: [
      { instrumentId: "NSE:HDFCBANK", side: "BUY", orderType: "MARKET", lots: 10, lotSize: 1, price: 1745, segment: "NSE_EQUITY" },
      { instrumentId: "NSE:ICICIBANK", side: "BUY", orderType: "MARKET", lots: 15, lotSize: 1, price: 1295, segment: "NSE_EQUITY" },
      { instrumentId: "NSE:SBIN", side: "BUY", orderType: "MARKET", lots: 20, lotSize: 1, price: 835, segment: "NSE_EQUITY" },
    ],
  },
];

export function BasketOrdersView({
  account,
  quotes,
  stagedLegs,
  onUpdateStagedLegs,
  isoBaskets,
  onExecuteBasket,
  onExitIsoBasket,
}: Props) {
  const [basketName, setBasketName] = useState("My Multi-Leg Strategy");
  const [mode, setMode] = useState<"ISO" | "COMB">("ISO");
  const [basketTarget, setBasketTarget] = useState(5000);
  const [basketStopLoss, setBasketStopLoss] = useState(2500);
  const [newInstId, setNewInstId] = useState(PAPER_INSTRUMENTS[0].id);
  const [newSide, setNewSide] = useState<OrderSide>("BUY");
  const [newLots, setNewLots] = useState(1);

  const marginSummary = useMemo(() => {
    let rawMargin = 0;
    let hasOptionBuy = false;
    let hasOptionSell = false;

    for (const leg of stagedLegs) {
      const qty = leg.lots * leg.lotSize;
      if (leg.segment === "NSE_OPTIONS") {
        if (leg.side === "BUY") {
          hasOptionBuy = true;
          rawMargin += leg.price * qty;
        } else {
          hasOptionSell = true;
          rawMargin += Math.max(leg.price * qty * 4.5, 48000);
        }
      } else {
        rawMargin += leg.price * qty * 0.2;
      }
    }

    const hedgeBenefitApplied = hasOptionBuy && hasOptionSell;
    const netMargin = hedgeBenefitApplied ? Math.round(rawMargin * 0.42) : Math.round(rawMargin);
    return { rawMargin: Math.round(rawMargin), netMargin, hedgeBenefitApplied };
  }, [stagedLegs]);

  function addManualLeg() {
    const inst = getInstrumentById(newInstId);
    const ltp = quotes[inst.id]?.last ?? inst.basePrice;
    onUpdateStagedLegs([
      ...stagedLegs,
      {
        instrumentId: inst.id,
        side: newSide,
        orderType: "MARKET",
        lots: Math.max(1, newLots),
        lotSize: inst.lotSize,
        price: ltp,
        segment: inst.segment,
      },
    ]);
  }

  return (
    <div className="nt-stack">
      {/* Pre-Built Options & Equity Strategies */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">PRE-BUILT MULTI-LEG TEMPLATES</span>
            <h2>One-Click Options &amp; Hedge Strategies</h2>
          </div>
        </div>
        <div className="nt-steps-grid">
          {PRESET_STRATEGIES.map((preset) => (
            <div key={preset.name} className="nt-step-card">
              <div className="nt-inline-actions" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <strong>{preset.name}</strong>
                <span className="source-tag">{preset.bias}</span>
              </div>
              <p style={{ marginBottom: 10 }}>{preset.summary}</p>
              <button
                type="button"
                className="nt-pill active"
                onClick={() => {
                  setBasketName(preset.name);
                  onUpdateStagedLegs(preset.legs);
                }}
              >
                Load into Basket ({preset.legs.length} legs)
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Basket Builder */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">MULTI-LEG EXECUTION · ISO vs. COMB MODE</span>
            <h2>Basket Order Builder</h2>
          </div>
          <div className="nt-inline-actions">
            <button
              type="button"
              className={`nt-pill${mode === "ISO" ? " active" : ""}`}
              onClick={() => setMode("ISO")}
              title="Isolated Mode: Keeps strategy separate with basket-level Target & SL"
            >
              ISO Mode (Isolated)
            </button>
            <button
              type="button"
              className={`nt-pill${mode === "COMB" ? " active" : ""}`}
              onClick={() => setMode("COMB")}
              title="Combined Mode: Merges legs directly into your main positions"
            >
              COMB Mode (Combined)
            </button>
          </div>
        </div>

        <p className="nt-muted-sm" style={{ marginBottom: 12 }}>
          {mode === "ISO"
            ? "ISO Mode monitors this basket independently with combined Basket Target & Basket Stop-Loss so parallel strategies never mix."
            : "COMB Mode executes every leg directly into your normal Portfolio positions book."}
        </p>

        {/* Add Leg Bar */}
        <div className="nt-calc-form four-col" style={{ marginBottom: 14 }}>
          <label>
            Basket Name
            <input value={basketName} onChange={(e) => setBasketName(e.target.value)} />
          </label>
          <label>
            Add Instrument
            <select value={newInstId} onChange={(e) => setNewInstId(e.target.value)}>
              {PAPER_INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} (₹{(quotes[i.id]?.last ?? i.basePrice).toLocaleString("en-IN")})
                </option>
              ))}
            </select>
          </label>
          <label>
            Side &amp; Lots
            <div className="nt-inline-actions">
              <select value={newSide} onChange={(e) => setNewSide(e.target.value as OrderSide)}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
              <input
                type="number"
                min={1}
                style={{ width: 70 }}
                value={newLots}
                onChange={(e) => setNewLots(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </label>
          <label>
            Stage Leg
            <button type="button" className="primary-button" onClick={addManualLeg} style={{ height: 36 }}>
              + Add Leg
            </button>
          </label>
        </div>

        {/* Staged Legs Table */}
        {stagedLegs.length === 0 ? (
          <p className="market-api-muted">
            No legs in basket yet. Pick a pre-built strategy above, click B/S in the Options Chain, or add a leg manually.
          </p>
        ) : (
          <>
            <div className="api-market-table-wrap">
              <table className="api-market-table">
                <thead>
                  <tr>
                    <th>Instrument / Contract</th>
                    <th>Side</th>
                    <th>Order</th>
                    <th>Lots (Qty)</th>
                    <th>Ref Price</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedLegs.map((leg, idx) => {
                    const inst = getInstrumentById(leg.instrumentId);
                    return (
                      <tr key={`${leg.instrumentId}-${idx}`}>
                        <th scope="row">
                          <strong>{leg.customLabel ?? inst.symbol}</strong>
                          <small>{inst.exchange} · Lot {leg.lotSize}</small>
                        </th>
                        <td>
                          <span className={`nt-badge ${leg.side === "BUY" ? "buy" : "sell"}`}>{leg.side}</span>
                        </td>
                        <td>{leg.orderType}</td>
                        <td>
                          {leg.lots} ({leg.lots * leg.lotSize})
                        </td>
                        <td>₹{leg.price.toLocaleString("en-IN")}</td>
                        <td>
                          <button
                            type="button"
                            className="nt-pill danger"
                            onClick={() => onUpdateStagedLegs(stagedLegs.filter((_, i) => i !== idx))}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mode === "ISO" && (
              <div className="nt-calc-form" style={{ marginTop: 12 }}>
                <label>
                  Basket Combined Target (₹ Profit)
                  <input
                    type="number"
                    min={100}
                    value={basketTarget}
                    onChange={(e) => setBasketTarget(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Basket Combined Stop-Loss (₹ Max Loss)
                  <input
                    type="number"
                    min={100}
                    value={basketStopLoss}
                    onChange={(e) => setBasketStopLoss(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
            )}

            <div className="nt-cost-preview" style={{ marginTop: 12 }}>
              <div>
                <span>Unhedged Margin</span>
                <strong>₹{marginSummary.rawMargin.toLocaleString("en-IN")}</strong>
              </div>
              <div>
                <span>Final Margin {marginSummary.hedgeBenefitApplied ? "(Hedge Benefit Applied)" : ""}</span>
                <strong className="nt-pos">₹{marginSummary.netMargin.toLocaleString("en-IN")}</strong>
              </div>
              <div>
                <span>Available Cash</span>
                <strong>₹{Math.round(account.availableCash).toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div className="nt-inline-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  onExecuteBasket({
                    name: basketName.trim() || "Multi-Leg Basket",
                    mode,
                    basketTarget,
                    basketStopLoss,
                    legs: stagedLegs,
                    hedgeBenefitApplied: marginSummary.hedgeBenefitApplied,
                    netMargin: marginSummary.netMargin,
                  })
                }
              >
                Execute Entire Basket ({stagedLegs.length} legs · {mode} Mode)
              </button>
              <button type="button" className="nt-pill" onClick={() => onUpdateStagedLegs([])}>
                Clear Basket
              </button>
            </div>
          </>
        )}
      </section>

      {/* Active Isolated Baskets */}
      {isoBaskets.length > 0 && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">ISOLATED STRATEGY TRACKER</span>
              <h2>Active ISO Baskets ({isoBaskets.length})</h2>
            </div>
          </div>
          <div className="nt-check-list">
            {isoBaskets.map((b) => {
              const livePnl = b.legs.reduce((sum, leg) => {
                const ltp = quotes[leg.instrumentId]?.last ?? leg.price;
                const diff = leg.side === "BUY" ? ltp - leg.price : leg.price - ltp;
                return sum + diff * leg.lots * leg.lotSize;
              }, 0);
              return (
                <div key={b.id} className="nt-check-item">
                  <span className="nt-check-dot">B</span>
                  <div>
                    <strong>
                      {b.name} ({b.legs.length} legs){b.hedgeBenefitApplied ? " · Hedged" : ""}
                    </strong>
                    <p>
                      Margin ₹{b.marginBlocked.toLocaleString("en-IN")} · Basket Target +₹{b.basketTarget} / SL −₹{b.basketStopLoss}
                    </p>
                  </div>
                  <strong className={livePnl >= 0 ? "nt-pos" : "nt-neg"} style={{ marginLeft: "auto", marginRight: 10 }}>
                    {livePnl >= 0 ? "+" : ""}₹{livePnl.toFixed(2)}
                  </strong>
                  <button type="button" className="nt-pill danger" onClick={() => onExitIsoBasket(b.id)}>
                    Exit Basket
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
