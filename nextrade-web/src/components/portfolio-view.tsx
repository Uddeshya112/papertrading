"use client";

import { useState } from "react";
import {
  ACCOUNT_CHALLENGES,
  computePositionPnl,
  DEFAULT_VIRTUAL_CAPITAL,
  type PaperAccountState,
} from "@/lib/paper-engine";
import { getInstrumentById, type LiveQuote } from "@/lib/paper-instruments";
import { formatINR } from "@/lib/format";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  onClosePosition: (positionId: string, exitPrice: number) => void;
  onCancelOrder: (orderId: string) => void;
  onModifyPendingOrder: (orderId: string, newPrice: number) => void;
  onNavigateToTrade: (instrumentId: string) => void;
  onManualRefill: (reason: string) => void;
  onSwitchChallenge: (challengeId: string, capital: number, name: string) => void;
};

export function PortfolioView({
  account,
  quotes,
  onClosePosition,
  onCancelOrder,
  onModifyPendingOrder,
  onNavigateToTrade,
  onManualRefill,
  onSwitchChallenge,
}: Props) {
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const holdings = account.positions.filter((p) => p.product === "DELIVERY");
  const openTradingPositions = account.positions.filter((p) => p.product !== "DELIVERY");
  const usedMargin = account.positions.reduce((sum, p) => sum + p.marginBlocked, 0);
  const investedCapital = holdings.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0);
  const unrealizedPnl = account.positions.reduce((sum, p) => {
    const ltp = quotes[p.instrumentId]?.last ?? p.entryPrice;
    return sum + computePositionPnl(p, ltp);
  }, 0);
  const lifetimeRealizedPnl = account.journal.reduce((sum, t) => sum + t.netPnl, 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const dailyRealized = account.journal
    .filter((t) => t.closedAt.startsWith(todayIso))
    .reduce((sum, t) => sum + t.netPnl, 0);
  const dailyPnl = dailyRealized + unrealizedPnl;
  const netEquity = account.availableCash + usedMargin + unrealizedPnl;
  const buyingPower = account.availableCash * 5; // Up to 5x intraday MIS buying power
  const pendingOrders = account.orders.filter(
    (o) => o.status === "PENDING" || o.status === "PARTIALLY_FILLED"
  );

  return (
    <div className="nt-stack">
      {/* Full Account Metrics Grid */}
      <div className="nt-kpi-grid">
        <div className="surface-card nt-kpi">
          <span className="card-kicker">TOTAL ACCOUNT EQUITY</span>
          <strong>₹{Math.round(netEquity).toLocaleString("en-IN")}</strong>
          <small>Default ₹{DEFAULT_VIRTUAL_CAPITAL.toLocaleString("en-IN")} · Refills: {account.resetCount}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">AVAILABLE CASH / BUYING POWER</span>
          <strong>₹{Math.round(account.availableCash).toLocaleString("en-IN")}</strong>
          <small>Intraday Buying Power: ₹{Math.round(buyingPower).toLocaleString("en-IN")}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">USED MARGIN / INVESTED</span>
          <strong>₹{Math.round(usedMargin).toLocaleString("en-IN")}</strong>
          <small>Delivery Holdings Invested: ₹{Math.round(investedCapital).toLocaleString("en-IN")}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">DAILY / LIFETIME P&amp;L</span>
          <strong className={dailyPnl >= 0 ? "nt-pos" : "nt-neg"}>
            {formatINR(dailyPnl, { signed: true })}
          </strong>
          <small>Lifetime Realized: {formatINR(lifetimeRealizedPnl, { signed: true })}</small>
        </div>
      </div>

      {/* Safe Refill + Optional Account Challenges (History Always Preserved) */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">IMMUTABLE HISTORY PRESERVATION · NEVER DELETES RECORDS</span>
            <h2>Virtual Capital Refill &amp; Account Challenges</h2>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => onManualRefill("Manual ₹10,00,000 virtual capital refill requested by trader.")}
          >
            + Refill ₹10,00,000 (Keep All History)
          </button>
        </div>
        <div className="nt-steps-grid">
          {ACCOUNT_CHALLENGES.map((ch) => (
            <div key={ch.id} className="nt-step-card">
              <div className="nt-inline-actions" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <strong>{ch.name}</strong>
                {account.challengeId === ch.id && <span className="nt-badge buy">Active</span>}
              </div>
              <p style={{ marginBottom: 8 }}>{ch.description}</p>
              <button
                type="button"
                className="nt-pill"
                disabled={account.challengeId === ch.id}
                onClick={() => onSwitchChallenge(ch.id, ch.capital, ch.name)}
              >
                {account.challengeId === ch.id ? "Current Account" : `Switch to ₹${ch.capital.toLocaleString("en-IN")}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Open Intraday & Derivatives Positions */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">INTRADAY (MIS) &amp; DERIVATIVES (NRML)</span>
            <h2>Open Positions ({openTradingPositions.length})</h2>
          </div>
        </div>
        {openTradingPositions.length === 0 ? (
          <p className="market-api-muted">No open intraday or F&amp;O positions.</p>
        ) : (
          <PositionsTable
            items={openTradingPositions}
            quotes={quotes}
            onClosePosition={onClosePosition}
            onNavigateToTrade={onNavigateToTrade}
          />
        )}
      </section>

      {/* Delivery Holdings */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">DELIVERY (CNC) DEMAT HOLDINGS</span>
            <h2>Holdings ({holdings.length})</h2>
          </div>
        </div>
        {holdings.length === 0 ? (
          <p className="market-api-muted">No delivery holdings yet. Buy any equity or ETF in Delivery (CNC) mode to build long-term holdings.</p>
        ) : (
          <PositionsTable
            items={holdings}
            quotes={quotes}
            onClosePosition={onClosePosition}
            onNavigateToTrade={onNavigateToTrade}
          />
        )}
      </section>

      {/* Pending & Partially Filled Orders */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">WORKING &amp; PARTIAL ORDERS</span>
            <h2>Pending / Partial Orders ({pendingOrders.length})</h2>
          </div>
        </div>
        {pendingOrders.length === 0 ? (
          <p className="market-api-muted">No pending or partially filled orders.</p>
        ) : (
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr><th>Symbol</th><th>Side / Type</th><th>Filled / Total</th><th>Price</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {pendingOrders.map((ord) => (
                  <tr key={ord.id}>
                    <th scope="row"><strong>{ord.symbol}</strong><small>{ord.product}</small></th>
                    <td><span className={`nt-badge ${ord.side === "BUY" ? "buy" : "sell"}`}>{ord.side}</span> {ord.orderType}</td>
                    <td>{ord.filledQuantity} / {ord.quantity}</td>
                    <td>
                      {editingOrderId === ord.id ? (
                        <input type="number" className="nt-input-sm" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                      ) : (
                        <>₹{ord.limitPrice ?? ord.triggerPrice ?? ord.filledPrice}</>
                      )}
                    </td>
                    <td><span className="quote-mode simulated">{ord.status}</span></td>
                    <td>
                      <div className="nt-inline-actions">
                        {editingOrderId === ord.id ? (
                          <button type="button" className="nt-pill active" onClick={() => { const v = Number(editPrice); if (v > 0) onModifyPendingOrder(ord.id, v); setEditingOrderId(null); }}>Save</button>
                        ) : (
                          <button type="button" className="nt-pill" onClick={() => { setEditingOrderId(ord.id); setEditPrice(String(ord.limitPrice ?? ord.triggerPrice ?? "")); }}>Modify</button>
                        )}
                        <button type="button" className="nt-pill danger" onClick={() => onCancelOrder(ord.id)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Immutable Refill & Reset History */}
      {account.refillHistory.length > 0 && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">PERMANENT FINANCIAL RECORD</span>
              <h2>Refill &amp; Reset History ({account.refillHistory.length})</h2>
            </div>
          </div>
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr><th>Date</th><th>Mode</th><th>Before</th><th>Added</th><th>After</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {account.refillHistory.map((r) => (
                  <tr key={r.id}>
                    <td><time>{new Date(r.date).toLocaleString("en-IN")}</time></td>
                    <td><span className="source-tag">{r.mode}</span></td>
                    <td>₹{r.balanceBefore.toLocaleString("en-IN")}</td>
                    <td className="nt-pos">+₹{r.amountAdded.toLocaleString("en-IN")}</td>
                    <td><strong>₹{r.balanceAfter.toLocaleString("en-IN")}</strong></td>
                    <td>{r.reason}</td>
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

function PositionsTable({
  items,
  quotes,
  onClosePosition,
  onNavigateToTrade,
}: {
  items: PaperAccountState["positions"];
  quotes: Record<string, LiveQuote>;
  onClosePosition: (positionId: string, exitPrice: number) => void;
  onNavigateToTrade: (instrumentId: string) => void;
}) {
  return (
    <div className="api-market-table-wrap">
      <table className="api-market-table">
        <thead>
          <tr><th>Instrument</th><th>Side / Product</th><th>Qty</th><th>Entry</th><th>LTP</th><th>SL / Target</th><th>Unrealized P&amp;L</th><th>Action</th></tr>
        </thead>
        <tbody>
          {items.map((pos) => {
            const inst = getInstrumentById(pos.instrumentId);
            const ltp = quotes[pos.instrumentId]?.last ?? pos.entryPrice;
            const pnl = computePositionPnl(pos, ltp);
            return (
              <tr key={pos.id}>
                <th scope="row">
                  <button type="button" className="nt-link-btn" onClick={() => onNavigateToTrade(pos.instrumentId)}>
                    <strong>{pos.symbol}</strong>
                  </button>
                  <small>{inst.exchange} · {pos.strategy}</small>
                </th>
                <td><span className={`nt-badge ${pos.side === "BUY" ? "buy" : "sell"}`}>{pos.side}</span> {pos.product}</td>
                <td>{pos.quantity}</td>
                <td>₹{pos.entryPrice.toLocaleString("en-IN")}</td>
                <td>₹{ltp.toLocaleString("en-IN")}</td>
                <td>{pos.stopLossPrice ? `SL ₹${pos.stopLossPrice}` : "—"} / {pos.targetPrice ? `T ₹${pos.targetPrice}` : "—"}</td>
                <td className={pnl >= 0 ? "nt-pos" : "nt-neg"}><strong>{formatINR(pnl, { signed: true })}</strong></td>
                <td><button type="button" className="nt-pill danger" onClick={() => onClosePosition(pos.id, ltp)}>Exit</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
