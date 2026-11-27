"use client";
import { formatINR } from "@/lib/format";

import { useMemo, useState } from "react";
import {
  generateOptionsChain,
  type ChainExpiry,
  type ChainUnderlying,
} from "@/lib/options-chain";
import type { LiveQuote } from "@/lib/paper-instruments";
import type { BasketLegDraft } from "./basket-orders-view";

type Props = {
  quotes: Record<string, LiveQuote>;
  onAddLegToBasket: (leg: BasketLegDraft) => void;
  onQuickTradeOption: (instrumentId: string) => void;
};

export function OptionsChainView({ quotes, onAddLegToBasket, onQuickTradeOption }: Props) {
  const [underlying, setUnderlying] = useState<ChainUnderlying>("NIFTY");
  const [expiry, setExpiry] = useState<ChainExpiry>("WEEKLY");
  const [strikeRange, setStrikeRange] = useState<5 | 10 | 21>(5);
  const [pcrBasis, setPcrBasis] = useState<"OI" | "VOLUME">("OI");
  const [onlyAligned, setOnlyAligned] = useState(false);

  const chain = useMemo(
    () => generateOptionsChain(underlying, expiry, quotes),
    [underlying, expiry, quotes]
  );

  const visibleRows = useMemo(() => {
    const atmIdx = chain.rows.findIndex((r) => r.isAtm);
    const center = atmIdx >= 0 ? atmIdx : Math.floor(chain.rows.length / 2);
    const sliced =
      strikeRange === 21
        ? chain.rows
        : chain.rows.slice(Math.max(0, center - strikeRange), Math.min(chain.rows.length, center + strikeRange + 1));
    if (!onlyAligned) return sliced;
    return sliced.filter((r) => r.call.movingWithUnderlying || r.put.movingWithUnderlying);
  }, [chain.rows, strikeRange, onlyAligned]);

  const nearbyPcr = useMemo(() => {
    const cSum = visibleRows.reduce((s, r) => s + (pcrBasis === "OI" ? r.call.oi : r.call.volume), 0);
    const pSum = visibleRows.reduce((s, r) => s + (pcrBasis === "OI" ? r.put.oi : r.put.volume), 0);
    return cSum > 0 ? Number((pSum / cSum).toFixed(2)) : 1;
  }, [visibleRows, pcrBasis]);

  const fullPcr = pcrBasis === "OI" ? chain.fullPcrOi : chain.fullPcrVolume;
  const fallbackOptionId = underlying === "NIFTY" ? "NFO:NIFTY-24500-CE" : "NFO:BANKNIFTY-52000-CE";

  return (
    <div className="nt-stack">
      {/* Controls & PCR Header */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">OPTIONS ANALYTICS · CALLS &amp; PUTS</span>
            <h2>
              {underlying === "NIFTY" ? "NIFTY 50" : "BANK NIFTY"} Options Chain
            </h2>
            <p>
              Spot {formatINR(chain.spotPrice)} (
              <span className={chain.spotChangePct >= 0 ? "nt-pos" : "nt-neg"}>
                {chain.spotChangePct >= 0 ? "+" : ""}
                {chain.spotChangePct.toFixed(2)}%
              </span>
              ) · ATM Strike {chain.atmStrike} · Lot Size {chain.lotSize}
            </p>
          </div>
          <div className="nt-inline-actions">
            <button
              type="button"
              className={`nt-pill${underlying === "NIFTY" ? " active" : ""}`}
              onClick={() => setUnderlying("NIFTY")}
            >
              NIFTY 50
            </button>
            <button
              type="button"
              className={`nt-pill${underlying === "BANKNIFTY" ? " active" : ""}`}
              onClick={() => setUnderlying("BANKNIFTY")}
            >
              BANK NIFTY
            </button>
            <button
              type="button"
              className={`nt-pill${expiry === "WEEKLY" ? " active" : ""}`}
              onClick={() => setExpiry("WEEKLY")}
            >
              Weekly Expiry
            </button>
            <button
              type="button"
              className={`nt-pill${expiry === "MONTHLY" ? " active" : ""}`}
              onClick={() => setExpiry("MONTHLY")}
            >
              Monthly Expiry
            </button>
          </div>
        </div>

        <div className="nt-chain-toolbar">
          <div className="nt-inline-actions">
            <span className="nt-muted-sm">Strikes:</span>
            {([5, 10, 21] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`nt-seg-tab${strikeRange === n ? " active" : ""}`}
                onClick={() => setStrikeRange(n)}
              >
                {n === 21 ? "Full Chain" : `Nearest ±${n}`}
              </button>
            ))}
            <label className="nt-checkbox-label" style={{ marginLeft: 8 }}>
              <input
                type="checkbox"
                checked={onlyAligned}
                onChange={(e) => setOnlyAligned(e.target.checked)}
              />
              <span>Moving with Underlying only</span>
            </label>
          </div>

          <div className="nt-pcr-strip">
            <button
              type="button"
              className={`nt-seg-tab${pcrBasis === "OI" ? " active" : ""}`}
              onClick={() => setPcrBasis("OI")}
            >
              PCR by OI
            </button>
            <button
              type="button"
              className={`nt-seg-tab${pcrBasis === "VOLUME" ? " active" : ""}`}
              onClick={() => setPcrBasis("VOLUME")}
            >
              PCR by Volume
            </button>
            <span className="source-tag">
              Nearby PCR: <strong>{nearbyPcr}</strong>
            </span>
            <span className="source-tag">
              Full-Chain PCR: <strong>{fullPcr}</strong>
            </span>
          </div>
        </div>

        {/* Chain Table */}
        <div className="api-market-table-wrap" style={{ marginTop: 12 }}>
          <table className="api-market-table nt-chain-table">
            <thead>
              <tr>
                <th colSpan={6} style={{ textAlign: "center", background: "#eef5ef" }}>
                  CALLS (CE)
                </th>
                <th style={{ textAlign: "center", background: "#18231d", color: "#fff" }}>
                  STRIKE
                </th>
                <th colSpan={6} style={{ textAlign: "center", background: "#fbf2f0" }}>
                  PUTS (PE)
                </th>
              </tr>
              <tr>
                <th>Action</th>
                <th>OI</th>
                <th>Vol</th>
                <th>IV%</th>
                <th>Bid / Ask</th>
                <th>LTP (Chg%)</th>
                <th style={{ textAlign: "center" }}>Strike</th>
                <th>LTP (Chg%)</th>
                <th>Bid / Ask</th>
                <th>IV%</th>
                <th>Vol</th>
                <th>OI</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.strike} className={row.isAtm ? "nt-atm-row" : ""}>
                  {/* CALL SIDE */}
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>
                    <div className="nt-inline-actions">
                      <button
                        type="button"
                        className="nt-mini-btn buy"
                        title="Add BUY Call leg to Basket"
                        onClick={() =>
                          onAddLegToBasket({
                            instrumentId: fallbackOptionId,
                            customLabel: row.call.symbol,
                            side: "BUY",
                            orderType: "MARKET",
                            lots: 1,
                            lotSize: chain.lotSize,
                            price: row.call.ltp,
                            segment: "NSE_OPTIONS",
                          })
                        }
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className="nt-mini-btn sell"
                        title="Add SELL Call leg to Basket"
                        onClick={() =>
                          onAddLegToBasket({
                            instrumentId: fallbackOptionId,
                            customLabel: row.call.symbol,
                            side: "SELL",
                            orderType: "MARKET",
                            lots: 1,
                            lotSize: chain.lotSize,
                            price: row.call.ltp,
                            segment: "NSE_OPTIONS",
                          })
                        }
                      >
                        S
                      </button>
                    </div>
                  </td>
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>{(row.call.oi / 1000).toFixed(1)}k</td>
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>{(row.call.volume / 1000).toFixed(1)}k</td>
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>{row.call.iv}%</td>
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>
                    {row.call.bid} / {row.call.ask}
                  </td>
                  <td className={row.call.itm ? "nt-itm-cell" : ""}>
                    <strong className="tabular-nums">{formatINR(row.call.ltp)}</strong>
                    <small className={row.call.changePct >= 0 ? "nt-pos" : "nt-neg"}>
                      {row.call.changePct >= 0 ? "+" : ""}
                      {row.call.changePct}% {row.call.movingWithUnderlying ? "●" : ""}
                    </small>
                  </td>

                  {/* STRIKE */}
                  <td className="nt-strike-cell">
                    <strong>{row.strike}</strong>
                    {row.isAtm && <small>ATM</small>}
                  </td>

                  {/* PUT SIDE */}
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>
                    <strong className="tabular-nums">{formatINR(row.put.ltp)}</strong>
                    <small className={row.put.changePct >= 0 ? "nt-pos" : "nt-neg"}>
                      {row.put.changePct >= 0 ? "+" : ""}
                      {row.put.changePct}% {row.put.movingWithUnderlying ? "●" : ""}
                    </small>
                  </td>
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>
                    {row.put.bid} / {row.put.ask}
                  </td>
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>{row.put.iv}%</td>
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>{(row.put.volume / 1000).toFixed(1)}k</td>
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>{(row.put.oi / 1000).toFixed(1)}k</td>
                  <td className={row.put.itm ? "nt-itm-cell" : ""}>
                    <div className="nt-inline-actions">
                      <button
                        type="button"
                        className="nt-mini-btn buy"
                        title="Add BUY Put leg to Basket"
                        onClick={() =>
                          onAddLegToBasket({
                            instrumentId: underlying === "NIFTY" ? "NFO:NIFTY-24500-PE" : fallbackOptionId,
                            customLabel: row.put.symbol,
                            side: "BUY",
                            orderType: "MARKET",
                            lots: 1,
                            lotSize: chain.lotSize,
                            price: row.put.ltp,
                            segment: "NSE_OPTIONS",
                          })
                        }
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className="nt-mini-btn sell"
                        title="Add SELL Put leg to Basket"
                        onClick={() =>
                          onAddLegToBasket({
                            instrumentId: underlying === "NIFTY" ? "NFO:NIFTY-24500-PE" : fallbackOptionId,
                            customLabel: row.put.symbol,
                            side: "SELL",
                            orderType: "MARKET",
                            lots: 1,
                            lotSize: chain.lotSize,
                            price: row.put.ltp,
                            segment: "NSE_OPTIONS",
                          })
                        }
                      >
                        S
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="nt-inline-actions" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <p className="market-api-footnote" style={{ margin: 0 }}>
            Shaded rows indicate In-The-Money (ITM) contracts. Dot (●) marks contracts moving in alignment with the underlying. Click B/S on any strike to stage multi-leg spreads in Basket Orders.
          </p>
          <button type="button" className="nt-pill" onClick={() => onQuickTradeOption(fallbackOptionId)}>
            Open Options Terminal →
          </button>
        </div>
      </section>
    </div>
  );
}
