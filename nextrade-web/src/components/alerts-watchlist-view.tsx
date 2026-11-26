"use client";

import { useState } from "react";
import type { PaperAccountState } from "@/lib/paper-engine";
import {
  getInstrumentById,
  PAPER_INSTRUMENTS,
  SEGMENT_LABELS,
  type LiveQuote,
} from "@/lib/paper-instruments";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  onToggleWatchlist: (instrumentId: string) => void;
  onCreateAlert: (params: {
    instrumentId: string;
    condition: "ABOVE" | "BELOW";
    targetPrice: number;
    note: string;
  }) => void;
  onDeleteAlert: (alertId: string) => void;
  onTradeInstrument: (instrumentId: string) => void;
};

export function AlertsWatchlistView({
  account,
  quotes,
  onToggleWatchlist,
  onCreateAlert,
  onDeleteAlert,
  onTradeInstrument,
}: Props) {
  const [alertInstrumentId, setAlertInstrumentId] = useState(PAPER_INSTRUMENTS[0].id);
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [targetPrice, setTargetPrice] = useState("");
  const [note, setNote] = useState("");

  function submitAlert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = Number(targetPrice);
    if (!val || val <= 0) return;
    onCreateAlert({ instrumentId: alertInstrumentId, condition, targetPrice: val, note });
    setTargetPrice("");
    setNote("");
  }

  const watchedInstruments = account.watchlist.map(getInstrumentById);

  return (
    <div className="nt-stack">
      {/* Personal Watchlist */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">SAVED LOCALLY PER ACCOUNT</span>
            <h2>Personal Watchlist ({watchedInstruments.length})</h2>
          </div>
        </div>

        {watchedInstruments.length === 0 ? (
          <p className="market-api-muted">
            Your watchlist is empty. Star any NSE, BSE, F&amp;O, MCX, or Currency instrument from the Trade Terminal.
          </p>
        ) : (
          <div className="api-market-table-wrap">
            <table className="api-market-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Segment</th>
                  <th>LTP</th>
                  <th>Bid / Ask</th>
                  <th>Change</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchedInstruments.map((inst) => {
                  const q = quotes[inst.id];
                  const up = (q?.change ?? 0) >= 0;
                  return (
                    <tr key={inst.id}>
                      <th scope="row">
                        <strong>{inst.symbol}</strong>
                        <small>{inst.name}</small>
                      </th>
                      <td>{SEGMENT_LABELS[inst.segment]}</td>
                      <td><strong>₹{(q?.last ?? inst.basePrice).toLocaleString("en-IN")}</strong></td>
                      <td>₹{q?.bid ?? inst.basePrice} / ₹{q?.ask ?? inst.basePrice}</td>
                      <td className={up ? "nt-pos" : "nt-neg"}>
                        {up ? "+" : ""}
                        {q?.changePercent.toFixed(2)}%
                      </td>
                      <td>
                        <div className="nt-inline-actions">
                          <button type="button" className="nt-pill active" onClick={() => onTradeInstrument(inst.id)}>
                            Trade
                          </button>
                          <button type="button" className="nt-pill" onClick={() => onToggleWatchlist(inst.id)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Price Alerts Engine */}
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">LIVE TICK MONITOR</span>
              <h2>Create Price Alert</h2>
            </div>
          </div>

          <form className="nt-order-form" onSubmit={submitAlert}>
            <label>
              Instrument
              <select value={alertInstrumentId} onChange={(e) => setAlertInstrumentId(e.target.value)}>
                {PAPER_INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.symbol} (LTP ₹{(quotes[inst.id]?.last ?? inst.basePrice).toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
            </label>
            <div className="nt-form-row">
              <label>
                Condition
                <select value={condition} onChange={(e) => setCondition(e.target.value as "ABOVE" | "BELOW")}>
                  <option value="ABOVE">Price crosses ABOVE</option>
                  <option value="BELOW">Price drops BELOW</option>
                </select>
              </label>
              <label>
                Target Price (₹)
                <input
                  type="number"
                  step="0.05"
                  required
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="e.g. 2250"
                />
              </label>
            </div>
            <label>
              Alert Note (optional)
              <input
                type="text"
                maxLength={120}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Breakout level above resistance"
              />
            </label>
            <button type="submit" className="primary-button">
              Create Price Alert
            </button>
          </form>
        </section>

        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">ACTIVE &amp; TRIGGERED</span>
              <h2>Your Alerts ({account.alerts.length})</h2>
            </div>
          </div>

          {account.alerts.length === 0 ? (
            <p className="market-api-muted">No alerts set yet. Alerts fire live toasts when simulated ticks cross your level.</p>
          ) : (
            <div className="nt-check-list">
              {account.alerts.map((alert) => (
                <div key={alert.id} className={`nt-check-item${!alert.active ? " passed" : ""}`}>
                  <span className="nt-check-dot">{alert.active ? "●" : "✓"}</span>
                  <div>
                    <strong>
                      {alert.symbol} {alert.condition === "ABOVE" ? "≥" : "≤"} ₹{alert.targetPrice.toLocaleString("en-IN")}
                    </strong>
                    <p>
                      {alert.note || "Price level watch"} ·{" "}
                      {alert.active
                        ? `Live LTP ₹${quotes[alert.instrumentId]?.last ?? "—"}`
                        : `Triggered at ${alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleTimeString() : ""}`}
                    </p>
                  </div>
                  <button type="button" className="nt-pill danger" onClick={() => onDeleteAlert(alert.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
