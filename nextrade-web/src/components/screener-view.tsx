"use client";

import { useMemo, useState } from "react";
import {
  PAPER_INSTRUMENTS,
  SEGMENT_LABELS,
  type LiveQuote,
} from "@/lib/paper-instruments";

type Props = {
  quotes: Record<string, LiveQuote>;
  onTradeInstrument: (instrumentId: string) => void;
};

type Direction = "GAINERS" | "LOSERS" | "VOLUME";
type InstFilter = "ALL" | "STOCKS" | "FUTURES" | "OPTIONS" | "MCX_FX";
type ChangeBasis = "PREV_CLOSE" | "OPEN";

export function ScreenerView({ quotes, onTradeInstrument }: Props) {
  const [direction, setDirection] = useState<Direction>("GAINERS");
  const [instFilter, setInstFilter] = useState<InstFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [changeBasis, setChangeBasis] = useState<ChangeBasis>("PREV_CLOSE");

  const enriched = useMemo(() => {
    return PAPER_INSTRUMENTS.map((inst) => {
      const q = quotes[inst.id];
      const last = q?.last ?? inst.basePrice;
      const open = q?.open ?? inst.basePrice;
      const prevClose = q?.prevClose ?? inst.basePrice;
      const pctVsClose = prevClose > 0 ? ((last - prevClose) / prevClose) * 100 : 0;
      const pctVsOpen = open > 0 ? ((last - open) / open) * 100 : 0;
      return {
        inst,
        last,
        bid: q?.bid ?? last,
        ask: q?.ask ?? last,
        volume: q?.volume ?? 0,
        openInterest: q?.openInterest,
        pctVsClose: Number(pctVsClose.toFixed(2)),
        pctVsOpen: Number(pctVsOpen.toFixed(2)),
      };
    });
  }, [quotes]);

  const sectors = useMemo(() => {
    const map = new Map<string, { count: number; avgPct: number }>();
    for (const row of enriched) {
      const cur = map.get(row.inst.sector) ?? { count: 0, avgPct: 0 };
      const pct = changeBasis === "PREV_CLOSE" ? row.pctVsClose : row.pctVsOpen;
      cur.avgPct = (cur.avgPct * cur.count + pct) / (cur.count + 1);
      cur.count += 1;
      map.set(row.inst.sector, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].avgPct - a[1].avgPct);
  }, [enriched, changeBasis]);

  const filtered = useMemo(() => {
    const list = enriched.filter(({ inst }) => {
      if (sectorFilter !== "ALL" && inst.sector !== sectorFilter) return false;
      if (instFilter === "STOCKS" && inst.segment !== "NSE_EQUITY" && inst.segment !== "BSE_EQUITY" && inst.segment !== "ETF_GSEC") return false;
      if (instFilter === "FUTURES" && inst.segment !== "NSE_FUTURES") return false;
      if (instFilter === "OPTIONS" && inst.segment !== "NSE_OPTIONS") return false;
      if (instFilter === "MCX_FX" && inst.segment !== "MCX_COMMODITY" && inst.segment !== "NSE_CURRENCY") return false;
      return true;
    });

    return list.sort((a, b) => {
      const aPct = changeBasis === "PREV_CLOSE" ? a.pctVsClose : a.pctVsOpen;
      const bPct = changeBasis === "PREV_CLOSE" ? b.pctVsClose : b.pctVsOpen;
      if (direction === "GAINERS") return bPct - aPct;
      if (direction === "LOSERS") return aPct - bPct;
      return b.volume - a.volume;
    });
  }, [enriched, direction, instFilter, sectorFilter, changeBasis]);

  return (
    <div className="nt-stack">
      {/* Sector & Index Momentum Rollup */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">SECTOR &amp; INDEX HEAT STRIP</span>
            <h2>Industry Performance Rollup</h2>
          </div>
          {sectorFilter !== "ALL" && (
            <button type="button" className="nt-pill" onClick={() => setSectorFilter("ALL")}>
              Clear Sector Filter ({sectorFilter}) ×
            </button>
          )}
        </div>
        <div className="nt-sector-grid">
          {sectors.map(([sector, info]) => (
            <button
              key={sector}
              type="button"
              className={`nt-sector-card${sectorFilter === sector ? " selected" : ""}`}
              onClick={() => setSectorFilter(sectorFilter === sector ? "ALL" : sector)}
            >
              <span>{sector}</span>
              <strong className={info.avgPct >= 0 ? "nt-pos" : "nt-neg"}>
                {info.avgPct >= 0 ? "+" : ""}
                {info.avgPct.toFixed(2)}%
              </strong>
              <small>{info.count} scrip(s)</small>
            </button>
          ))}
        </div>
      </section>

      {/* Main Smart Market Screener */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">SMART MARKET SCANNER</span>
            <h2>Stocks, Futures &amp; Options Screener</h2>
            <p>Scan top movers by direction, instrument type, and session-open vs. previous-close performance.</p>
          </div>
        </div>

        <div className="nt-chain-toolbar" style={{ marginBottom: 12 }}>
          <div className="nt-inline-actions">
            {(["GAINERS", "LOSERS", "VOLUME"] as Direction[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`nt-pill${direction === d ? " active" : ""}`}
                onClick={() => setDirection(d)}
              >
                {d === "GAINERS" ? "Top Gainers" : d === "LOSERS" ? "Top Losers" : "High Volume"}
              </button>
            ))}
          </div>

          <div className="nt-inline-actions">
            {(
              [
                ["ALL", "All"],
                ["STOCKS", "Stocks & ETFs"],
                ["FUTURES", "Futures"],
                ["OPTIONS", "Options"],
                ["MCX_FX", "MCX / FX"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`nt-seg-tab${instFilter === val ? " active" : ""}`}
                onClick={() => setInstFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="nt-inline-actions">
            <button
              type="button"
              className={`nt-seg-tab${changeBasis === "PREV_CLOSE" ? " active" : ""}`}
              onClick={() => setChangeBasis("PREV_CLOSE")}
            >
              Chg % vs Prev Close
            </button>
            <button
              type="button"
              className={`nt-seg-tab${changeBasis === "OPEN" ? " active" : ""}`}
              onClick={() => setChangeBasis("OPEN")}
            >
              Chg % vs Open
            </button>
          </div>
        </div>

        <div className="api-market-table-wrap">
          <table className="api-market-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Segment / Parent</th>
                <th>LTP</th>
                <th>Chg % ({changeBasis === "PREV_CLOSE" ? "Prev Close" : "Open"})</th>
                <th>Bid / Ask</th>
                <th>Volume</th>
                <th>Open Interest</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const pct = changeBasis === "PREV_CLOSE" ? row.pctVsClose : row.pctVsOpen;
                return (
                  <tr key={row.inst.id}>
                    <th scope="row">
                      <strong>{row.inst.symbol}</strong>
                      <small>{row.inst.sector}</small>
                    </th>
                    <td>
                      {SEGMENT_LABELS[row.inst.segment]}
                      {row.inst.greeks && <small>Parent: {row.inst.greeks.underlyingSymbol}</small>}
                    </td>
                    <td><strong>₹{row.last.toLocaleString("en-IN")}</strong></td>
                    <td className={pct >= 0 ? "nt-pos" : "nt-neg"}>
                      <strong>
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(2)}%
                      </strong>
                    </td>
                    <td>₹{row.bid} / ₹{row.ask}</td>
                    <td>{row.volume.toLocaleString("en-IN")}</td>
                    <td>{row.openInterest ? row.openInterest.toLocaleString("en-IN") : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="nt-pill active"
                        onClick={() => onTradeInstrument(row.inst.id)}
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
