"use client";

import { useMemo, useState } from "react";
import {
  calculateIndianCharges,
  calculatePositionSize,
  type ProductType,
} from "@/lib/indian-charges";
import {
  computeRequiredMargin,
  EMOTION_TAGS,
  STRATEGY_TAGS,
  type EmotionTag,
  type OrderSide,
  type OrderType,
  type PaperAccountState,
  type PlaceOrderInput,
  type StrategyTag,
  type TimeInForce,
} from "@/lib/paper-engine";
import {
  getInstrumentById,
  PAPER_INSTRUMENTS,
  REGIME_META,
  SEGMENT_LABELS,
  type LiveQuote,
  type MarketRegime,
  type MarketSegment,
} from "@/lib/paper-instruments";
import { TradingViewWidget } from "./tradingview-widget";
import { evaluatePreTradeMistakes } from "@/lib/teacher-coach";
import { roundToTick } from "@/lib/paper-instruments";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  selectedId: string;
  onSelectInstrument: (id: string) => void;
  regime: MarketRegime;
  onChangeRegime: (regime: MarketRegime) => void;
  simRunning: boolean;
  onToggleSim: () => void;
  onPlaceOrder: (input: PlaceOrderInput) => void;
  onToggleWatchlist: (id: string) => void;
  teacherMode: boolean;
};

const ORDER_TYPES: OrderType[] = ["MARKET", "LIMIT", "AUTO-LIMIT", "SL", "SL-M", "BRACKET", "COVER"];

export function TradingTerminal({
  account,
  quotes,
  selectedId,
  onSelectInstrument,
  regime,
  onChangeRegime,
  simRunning,
  onToggleSim,
  onPlaceOrder,
  onToggleWatchlist,
  teacherMode,
}: Props) {
  const [segmentFilter, setSegmentFilter] = useState<MarketSegment | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<"SIM" | "TV">("SIM");

  // Order ticket state
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [product, setProduct] = useState<ProductType>("INTRADAY");
  const [tif, setTif] = useState<TimeInForce>("DAY");
  const [lots, setLots] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [autoOffsetPct, setAutoOffsetPct] = useState(1);
  const [autoWaitMins, setAutoWaitMins] = useState(10);
  const [triggerPrice, setTriggerPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [strategy, setStrategy] = useState<StrategyTag>("Intraday Breakout");
  const [emotion, setEmotion] = useState<EmotionTag>("Disciplined");
  const [rationale, setRationale] = useState("");
  const [riskPctHelper, setRiskPctHelper] = useState(1);

  const instrument = getInstrumentById(selectedId);
  const quote = quotes[instrument.id];
  const isDerivative =
    instrument.segment === "NSE_FUTURES" ||
    instrument.segment === "NSE_OPTIONS" ||
    instrument.segment === "MCX_COMMODITY" ||
    instrument.segment === "NSE_CURRENCY";

  const effectiveProduct: ProductType = isDerivative ? "NRML" : product;

  const filteredInstruments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PAPER_INSTRUMENTS.filter((item) => {
      if (segmentFilter !== "ALL" && item.segment !== segmentFilter) return false;
      if (!q) return true;
      return `${item.symbol} ${item.name} ${item.exchange} ${item.sector}`.toLowerCase().includes(q);
    });
  }, [segmentFilter, search]);

  const quantity = Math.max(1, lots) * instrument.lotSize;
  const activePrice =
    orderType === "LIMIT" && Number(limitPrice) > 0
      ? Number(limitPrice)
      : side === "BUY"
        ? quote?.ask ?? instrument.basePrice
        : quote?.bid ?? instrument.basePrice;

  const requiredMargin = computeRequiredMargin(instrument, effectiveProduct, side, activePrice, quantity);
  const estCharges = calculateIndianCharges({
    segment: instrument.segment,
    product: effectiveProduct,
    side,
    price: activePrice,
    quantity,
    brokeragePlan: account.brokeragePlan,
  });

  function applyRiskSizing() {
    const sl = Number(stopLossPrice);
    if (!sl || sl <= 0 || Math.abs(activePrice - sl) < instrument.tickSize) return;
    const tgt = Number(targetPrice) > 0 ? Number(targetPrice) : activePrice + (activePrice - sl) * 1.5;
    const sized = calculatePositionSize({
      capital: account.startingCapital,
      riskPercent: riskPctHelper,
      entryPrice: activePrice,
      stopLossPrice: sl,
      targetPrice: tgt,
      lotSize: instrument.lotSize,
      segment: instrument.segment,
      product: effectiveProduct,
      brokeragePlan: account.brokeragePlan,
    });
    if (sized.recommendedLots >= 1) {
      setLots(sized.recommendedLots);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onPlaceOrder({
      instrumentId: instrument.id,
      side,
      orderType,
      product: effectiveProduct,
      tif,
      lots: Math.max(1, lots),
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
      autoLimitOffsetPct: orderType === "AUTO-LIMIT" ? autoOffsetPct : undefined,
      autoLimitWaitMinutes: orderType === "AUTO-LIMIT" ? autoWaitMins : undefined,
      triggerPrice: triggerPrice ? Number(triggerPrice) : undefined,
      stopLossPrice: stopLossPrice ? Number(stopLossPrice) : undefined,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      strategy,
      emotion,
      regime,
      rationale,
    });
    setRationale("");
  }

  const inWatchlist = account.watchlist.includes(instrument.id);

  const teacherFeedback = useMemo(
    () =>
      teacherMode
        ? evaluatePreTradeMistakes({
            account,
            instrumentId: instrument.id,
            side,
            orderType,
            entryPrice: activePrice,
            quantity,
            stopLossPrice: stopLossPrice ? Number(stopLossPrice) : undefined,
            targetPrice: targetPrice ? Number(targetPrice) : undefined,
            emotion,
            rationale,
          })
        : [],
    [teacherMode, account, instrument.id, side, orderType, activePrice, quantity, stopLossPrice, targetPrice, emotion, rationale]
  );

  function applyTeacherAutoFix() {
    const slDist = Math.max(instrument.tickSize * 4, activePrice * 0.015);
    const fixedSl = roundToTick(side === "BUY" ? activePrice - slDist : activePrice + slDist, instrument.tickSize);
    const fixedTgt = roundToTick(side === "BUY" ? activePrice + slDist * 2 : activePrice - slDist * 2, instrument.tickSize);
    setStopLossPrice(String(fixedSl));
    setTargetPrice(String(fixedTgt));
    const sized = calculatePositionSize({
      capital: account.startingCapital,
      riskPercent: 1,
      entryPrice: activePrice,
      stopLossPrice: fixedSl,
      targetPrice: fixedTgt,
      lotSize: instrument.lotSize,
      segment: instrument.segment,
      product: effectiveProduct,
      brokeragePlan: account.brokeragePlan,
    });
    if (sized.recommendedLots >= 1) setLots(sized.recommendedLots);
    if (!rationale.trim()) {
      setRationale(`Teacher-guided ${strategy}: 1% risk sizing with 1:2 R:R`);
    }
    if (emotion === "FOMO" || emotion === "Revenge") setEmotion("Disciplined");
  }

  return (
    <div className="nt-terminal-wrap">
      {/* Market Regime & Simulator Control Bar */}
      <section className="surface-card nt-regime-bar" aria-label="Market simulation controls">
        <div className="nt-regime-left">
          <span className="card-kicker">MARKET CONDITION SIMULATOR</span>
          <div className="nt-pill-row">
            {(Object.keys(REGIME_META) as MarketRegime[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`nt-pill${regime === key ? " active" : ""}`}
                onClick={() => onChangeRegime(key)}
                title={REGIME_META[key].description}
              >
                {REGIME_META[key].label}
              </button>
            ))}
          </div>
          <p className="nt-muted-sm">{REGIME_META[regime].description}</p>
        </div>
        <div className="nt-regime-right">
          <button type="button" className="primary-button" onClick={onToggleSim}>
            {simRunning ? "Pause live ticks" : "Resume live ticks"}
          </button>
          <span className="source-tag">
            {account.brokeragePlan === "ZERO_BROKERAGE" ? "₹0 Brokerage Mode" : "₹20/Order Mode"}
          </span>
        </div>
      </section>

      <div className="nt-terminal-grid">
        {/* Left Column: Multi-Segment Market Watch */}
        <aside className="surface-card nt-market-watch">
          <div className="card-heading">
            <div>
              <span className="card-kicker">INDIAN SEGMENTS</span>
              <h2>Market Watch</h2>
            </div>
            <span className="source-tag">{filteredInstruments.length} scrips</span>
          </div>

          <input
            className="nt-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NSE, BSE, F&O, MCX, USDINR…"
          />

          <div className="nt-segment-tabs">
            <button
              type="button"
              className={`nt-seg-tab${segmentFilter === "ALL" ? " active" : ""}`}
              onClick={() => setSegmentFilter("ALL")}
            >
              All
            </button>
            {(Object.keys(SEGMENT_LABELS) as MarketSegment[]).map((seg) => (
              <button
                key={seg}
                type="button"
                className={`nt-seg-tab${segmentFilter === seg ? " active" : ""}`}
                onClick={() => setSegmentFilter(seg)}
              >
                {SEGMENT_LABELS[seg]}
              </button>
            ))}
          </div>

          <div className="nt-watch-list">
            {filteredInstruments.map((item) => {
              const q = quotes[item.id];
              const up = (q?.change ?? 0) >= 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nt-watch-row${item.id === instrument.id ? " selected" : ""}`}
                  onClick={() => {
                    onSelectInstrument(item.id);
                    setLots(1);
                    setLimitPrice("");
                    setTriggerPrice("");
                    setStopLossPrice("");
                    setTargetPrice("");
                  }}
                >
                  <div className="nt-watch-sym">
                    <strong>{item.symbol}</strong>
                    <small>
                      {item.exchange} · Lot {item.lotSize}
                    </small>
                  </div>
                  <div className="nt-watch-price">
                    <strong>₹{(q?.last ?? item.basePrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    <small className={up ? "nt-pos" : "nt-neg"}>
                      {up ? "+" : ""}
                      {q?.changePercent.toFixed(2)}%
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Column: Chart + Instrument Specs / Greeks */}
        <section className="surface-card nt-chart-stage">
          <div className="card-heading">
            <div>
              <span className="card-kicker">
                {instrument.exchange} · {SEGMENT_LABELS[instrument.segment]} · {instrument.sector}
              </span>
              <h2>
                {instrument.symbol} — {instrument.name}
              </h2>
            </div>
            <div className="nt-inline-actions">
              <button
                type="button"
                className="nt-pill"
                onClick={() => onToggleWatchlist(instrument.id)}
              >
                {inWatchlist ? "★ Saved" : "☆ Watchlist"}
              </button>
              <button
                type="button"
                className={`nt-pill${chartMode === "SIM" ? " active" : ""}`}
                onClick={() => setChartMode("SIM")}
              >
                Live Sim Chart
              </button>
              <button
                type="button"
                className={`nt-pill${chartMode === "TV" ? " active" : ""}`}
                onClick={() => setChartMode("TV")}
              >
                TradingView
              </button>
            </div>
          </div>

          {quote && (
            <div className="nt-quote-strip">
              <div>
                <span className="nt-kicker-xs">LTP</span>
                <strong className="nt-ltp">
                  ₹{quote.last.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </strong>
                <span className={`nt-delta ${quote.change >= 0 ? "nt-pos" : "nt-neg"}`}>
                  {quote.change >= 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({quote.changePercent >= 0 ? "+" : ""}
                  {quote.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="nt-quote-meta">
                <span>Bid: <b>₹{quote.bid.toLocaleString("en-IN")}</b></span>
                <span>Ask: <b>₹{quote.ask.toLocaleString("en-IN")}</b></span>
                <span>High: <b>₹{quote.high.toLocaleString("en-IN")}</b></span>
                <span>Low: <b>₹{quote.low.toLocaleString("en-IN")}</b></span>
                <span>Lot: <b>{instrument.lotSize}</b></span>
                {quote.openInterest && (
                  <span>OI: <b>{quote.openInterest.toLocaleString("en-IN")}</b></span>
                )}
              </div>
            </div>
          )}

          {chartMode === "SIM" && quote ? (
            <SimulatedPriceChart
              history={quote.history}
              symbol={instrument.symbol}
              positive={quote.change >= 0}
              stopLoss={Number(stopLossPrice) > 0 ? Number(stopLossPrice) : undefined}
              target={Number(targetPrice) > 0 ? Number(targetPrice) : undefined}
            />
          ) : (
            <div className="nt-tv-box">
              <TradingViewWidget
                kind="advanced-chart"
                symbol={instrument.tradingViewSymbol}
                title={`${instrument.symbol} chart`}
              />
            </div>
          )}

          {/* Derivatives / Options Greeks / Futures Basis Panel */}
          {instrument.greeks && (
            <div className="nt-greeks-bar">
              <span className="card-kicker">OPTION GREEKS &amp; EXPIRY ({instrument.expiryDate})</span>
              <div className="nt-greeks-grid">
                <div><span>Delta</span><strong>{instrument.greeks.delta}</strong></div>
                <div><span>Gamma</span><strong>{instrument.greeks.gamma}</strong></div>
                <div><span>Theta / day</span><strong className="nt-neg">₹{instrument.greeks.theta}</strong></div>
                <div><span>Vega</span><strong>{instrument.greeks.vega}</strong></div>
                <div><span>Implied Vol</span><strong>{instrument.greeks.iv}%</strong></div>
                <div><span>DTE</span><strong>{instrument.greeks.daysToExpiry}d</strong></div>
              </div>
            </div>
          )}

          {instrument.spotReference && quote && (
            <div className="nt-greeks-bar">
              <span className="card-kicker">FUTURES CONTRACT SPECS ({instrument.expiryDate})</span>
              <div className="nt-greeks-grid">
                <div><span>Spot Ref</span><strong>₹{instrument.spotReference.toLocaleString("en-IN")}</strong></div>
                <div><span>Basis (Fut-Spot)</span><strong>₹{(quote.last - instrument.spotReference).toFixed(2)}</strong></div>
                <div><span>Notional / Lot</span><strong>₹{(quote.last * instrument.lotSize).toLocaleString("en-IN")}</strong></div>
                <div><span>SPAN+Exp Margin</span><strong>{instrument.marginPercent}%</strong></div>
              </div>
            </div>
          )}

          {instrument.unitLabel && (
            <div className="nt-greeks-bar">
              <span className="card-kicker">CONTRACT SPECIFICATION</span>
              <p className="nt-muted-sm">
                Quoted {instrument.unitLabel} · Expiry: {instrument.expiryDate} · Tick size ₹{instrument.tickSize} · Margin {instrument.marginPercent}%.
              </p>
            </div>
          )}
        </section>

        {/* Right Column: Order Entry Ticket */}
        <aside className="surface-card nt-order-ticket">
          <div className="card-heading">
            <div>
              <span className="card-kicker">PAPER ORDER TICKET</span>
              <h2>{instrument.symbol}</h2>
            </div>
            <span className="source-tag">Cash: ₹{Math.round(account.availableCash).toLocaleString("en-IN")}</span>
          </div>

          <div className="nt-side-toggle">
            <button
              type="button"
              className={`nt-side-btn buy${side === "BUY" ? " active" : ""}`}
              onClick={() => setSide("BUY")}
            >
              BUY / LONG
            </button>
            <button
              type="button"
              className={`nt-side-btn sell${side === "SELL" ? " active" : ""}`}
              onClick={() => setSide("SELL")}
            >
              SELL / SHORT
            </button>
          </div>

          <form className="nt-order-form" onSubmit={handleSubmit}>
            <div className="nt-form-row">
              <label>
                Order Type
                <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
                  {ORDER_TYPES.map((ot) => (
                    <option key={ot} value={ot}>{ot}</option>
                  ))}
                </select>
              </label>
              <label>
                Product
                <select
                  value={effectiveProduct}
                  disabled={isDerivative}
                  onChange={(e) => setProduct(e.target.value as ProductType)}
                >
                  {isDerivative ? (
                    <option value="NRML">NRML (Margin)</option>
                  ) : (
                    <>
                      <option value="INTRADAY">Intraday (MIS · 5x)</option>
                      <option value="DELIVERY">Delivery (CNC · 1x)</option>
                    </>
                  )}
                </select>
              </label>
            </div>

            <div className="nt-form-row">
              <label>
                {instrument.lotSize > 1 ? `Lots (×${instrument.lotSize} = ${quantity})` : "Quantity (Shares)"}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={lots}
                  onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                Validity (TIF)
                <select value={tif} onChange={(e) => setTif(e.target.value as TimeInForce)}>
                  <option value="DAY">DAY</option>
                  <option value="GTC">GTC (Good Till Cancelled)</option>
                </select>
              </label>
            </div>

            {orderType === "AUTO-LIMIT" && (
              <div className="nt-form-row">
                <label>
                  Offset % ({side === "BUY" ? "below" : "above"} LTP)
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={autoOffsetPct}
                    onChange={(e) => setAutoOffsetPct(Math.max(0.1, Number(e.target.value) || 0.5))}
                  />
                </label>
                <label>
                  Auto-Cancel Wait (mins)
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={autoWaitMins}
                    onChange={(e) => setAutoWaitMins(Math.max(1, Number(e.target.value) || 5))}
                  />
                </label>
              </div>
            )}

            {(orderType === "LIMIT" || orderType === "SL") && (
              <label>
                Limit Price (₹)
                <input
                  type="number"
                  step={instrument.tickSize}
                  required
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={String(quote?.last ?? instrument.basePrice)}
                />
              </label>
            )}

            {(orderType === "SL" || orderType === "SL-M") && (
              <label>
                Trigger Price (₹)
                <input
                  type="number"
                  step={instrument.tickSize}
                  required
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  placeholder={String(quote?.last ?? instrument.basePrice)}
                />
              </label>
            )}

            <div className="nt-form-row">
              <label>
                Stop-Loss (₹){orderType === "BRACKET" || orderType === "COVER" ? " *" : " (optional)"}
                <input
                  type="number"
                  step={instrument.tickSize}
                  required={orderType === "BRACKET" || orderType === "COVER"}
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  placeholder="e.g. 2165"
                />
              </label>
              <label>
                Target (₹){orderType === "BRACKET" ? " *" : " (optional)"}
                <input
                  type="number"
                  step={instrument.tickSize}
                  required={orderType === "BRACKET"}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="e.g. 2255"
                />
              </label>
            </div>

            {/* 1-Click Risk Position Sizer */}
            <div className="nt-risk-helper">
              <span>Auto-size by risk %:</span>
              <select
                value={riskPctHelper}
                onChange={(e) => setRiskPctHelper(Number(e.target.value))}
                aria-label="Risk percentage"
              >
                <option value={0.5}>0.5%</option>
                <option value={1}>1.0%</option>
                <option value={2}>2.0%</option>
              </select>
              <button
                type="button"
                className="nt-pill"
                onClick={applyRiskSizing}
                disabled={!stopLossPrice}
                title="Enter a Stop-Loss price first to auto-calculate position size"
              >
                Calc Qty
              </button>
            </div>

            <div className="nt-form-row">
              <label>
                Strategy Tag
                <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyTag)}>
                  {STRATEGY_TAGS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Mindset / Emotion
                <select value={emotion} onChange={(e) => setEmotion(e.target.value as EmotionTag)}>
                  {EMOTION_TAGS.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Trade Rationale (saved to Journal)
              <input
                type="text"
                maxLength={180}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="e.g., Breakout above resistance on volume"
              />
            </label>

            <div className="nt-cost-preview">
              <div>
                <span>Est. Margin Blocked</span>
                <strong>₹{requiredMargin.toLocaleString("en-IN")}</strong>
              </div>
              <div>
                <span>Est. Indian Charges ({estCharges.sttLabel}+GST+Stamp)</span>
                <strong>₹{estCharges.totalCharges.toFixed(2)}</strong>
              </div>
              <div>
                <span>Notional Value</span>
                <strong>₹{(activePrice * quantity).toLocaleString("en-IN")}</strong>
              </div>
            </div>

            {teacherMode && teacherFeedback.length > 0 && (
              <div className="nt-guardrail-box" role="region" aria-label="Teacher pre-trade check">
                <div className="nt-guardrail-head">
                  <span className="card-kicker" style={{ color: "#17613f" }}>TEACHER PRE-TRADE CHECK</span>
                  <button type="button" className="nt-pill active" onClick={applyTeacherAutoFix}>
                    Apply Teacher Fix
                  </button>
                </div>
                {teacherFeedback.slice(0, 3).map((item) => (
                  <div key={item.id} className={`nt-guardrail-item ${item.level.toLowerCase()}`}>
                    <strong>{item.title}</strong>
                    <span>{item.improvement}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className={`nt-submit-order ${side === "BUY" ? "buy" : "sell"}`}
            >
              {side} {quantity} {instrument.symbol} ({orderType})
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function SimulatedPriceChart({
  history,
  symbol,
  positive,
  stopLoss,
  target,
}: {
  history: number[];
  symbol: string;
  positive: boolean;
  stopLoss?: number;
  target?: number;
}) {
  const width = 640;
  const height = 240;
  const pad = 24;
  const allValues = [...history];
  if (stopLoss) allValues.push(stopLoss);
  if (target) allValues.push(target);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 0.01);

  const toX = (idx: number) =>
    pad + (idx / Math.max(1, history.length - 1)) * (width - pad * 2);
  const toY = (val: number) =>
    height - pad - ((val - min) / span) * (height - pad * 2);

  const linePoints = history.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const areaPoints = `${toX(0).toFixed(1)},${height - pad} ${linePoints} ${toX(history.length - 1).toFixed(1)},${height - pad}`;
  const stroke = positive ? "#17613f" : "#b84739";
  const fill = positive ? "rgba(23, 97, 63, 0.12)" : "rgba(184, 71, 57, 0.12)";

  return (
    <div className="nt-svg-chart-wrap" aria-label={`Live simulated price chart for ${symbol}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="nt-svg-chart">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad + t * (height - pad * 2);
          const priceLabel = (max - t * span).toFixed(2);
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#edf0ed" strokeDasharray="3 3" />
              <text x={width - pad + 4} y={y + 3} fontSize="9" fill="#8b968e">
                {priceLabel}
              </text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill={fill} />
        <polyline points={linePoints} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />

        {target && (
          <g>
            <line
              x1={pad}
              y1={toY(target)}
              x2={width - pad}
              y2={toY(target)}
              stroke="#17613f"
              strokeWidth="1.2"
              strokeDasharray="5 4"
            />
            <text x={pad + 4} y={toY(target) - 4} fontSize="9" fill="#17613f" fontWeight="700">
              TARGET ₹{target}
            </text>
          </g>
        )}

        {stopLoss && (
          <g>
            <line
              x1={pad}
              y1={toY(stopLoss)}
              x2={width - pad}
              y2={toY(stopLoss)}
              stroke="#b84739"
              strokeWidth="1.2"
              strokeDasharray="5 4"
            />
            <text x={pad + 4} y={toY(stopLoss) - 4} fontSize="9" fill="#b84739" fontWeight="700">
              STOP-LOSS ₹{stopLoss}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
