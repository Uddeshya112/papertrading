"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CHART_TIMEFRAMES,
  computeIndicators,
  generateCandles,
  generateMarketDepth,
  updateLatestCandle,
  type Candle,
  type ChartTimeframe,
  type IndicatorOverlay,
} from "@/lib/candlestick-engine";
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
  getDynamicInstrumentDisplay,
  REGIME_META,
  roundToTick,
  SEGMENT_LABELS,
  type LiveQuote,
  type MarketRegime,
  type MarketSegment,
} from "@/lib/paper-instruments";
import { evaluatePreTradeMistakes } from "@/lib/teacher-coach";
import { TradingViewWidget } from "./tradingview-widget";
import { formatINR } from "@/lib/format";
import { InfoTip } from "./info-tip";
import { NavIcon } from "./nav-icons";

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
  uiMode?: "SIMPLE" | "PRO";
};

type DrawTool = "NONE" | "HLINE" | "TRENDLINE";
type TrendDrawing = { x1: number; y1: number; x2: number; y2: number };

const ORDER_TYPES: OrderType[] = ["MARKET", "LIMIT", "AUTO-LIMIT", "SL", "SL-M", "BRACKET", "COVER"];

export function ProTerminalView({
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
  uiMode = "SIMPLE",
}: Props) {
  const [segmentFilter, setSegmentFilter] = useState<MarketSegment | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<"CANDLES" | "TV">("CANDLES");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [secondaryTf, setSecondaryTf] = useState<ChartTimeframe>("1H");
  const [splitLayout, setSplitLayout] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [depthLevels, setDepthLevels] = useState<5 | 10>(5);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(uiMode === "PRO");
  const [depthOpen, setDepthOpen] = useState(uiMode === "PRO");

  useEffect(() => {
    setAdvancedOpen(uiMode === "PRO");
    setDepthOpen(uiMode === "PRO");
  }, [uiMode]);

  // Indicators & drawing tools
  const [showSma, setShowSma] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [showBb, setShowBb] = useState(false);
  const [showSr, setShowSr] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [drawTool, setDrawTool] = useState<DrawTool>("NONE");
  const [hLines, setHLines] = useState<number[]>([]);
  const [trendLines, setTrendLines] = useState<TrendDrawing[]>([]);
  const [pendingTrendStart, setPendingTrendStart] = useState<{ x: number; y: number } | null>(null);

  // Order ticket
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [product, setProduct] = useState<ProductType>("INTRADAY");
  const [tif, setTif] = useState<TimeInForce>("DAY");
  const [lots, setLots] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyHint, setQtyHint] = useState("");
  const lastSubmitRef = useRef(0);
  const [limitPrice, setLimitPrice] = useState("");
  const [autoOffsetPct, setAutoOffsetPct] = useState(1);
  const [autoWaitMins, setAutoWaitMins] = useState(10);
  const [triggerPrice, setTriggerPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [strategy, setStrategy] = useState<StrategyTag>("Positional / Delivery");
  const [emotion, setEmotion] = useState<EmotionTag>("Disciplined");
  const [confidenceLevel, setConfidenceLevel] = useState(4);
  const [rationale, setRationale] = useState("");
  const [riskPctHelper, setRiskPctHelper] = useState(1);
  const [confirmPending, setConfirmPending] = useState<PlaceOrderInput | null>(null);

  // Reset order ticket prices and drawings whenever the active symbol changes
  useEffect(() => {
    setLimitPrice("");
    setTriggerPrice("");
    setStopLossPrice("");
    setTargetPrice("");
    setHLines([]);
    setTrendLines([]);
    setPendingTrendStart(null);
  }, [selectedId]);

  // Keyboard shortcuts: B = Buy, S = Sell, F = Fullscreen, Escape = Close Fullscreen/Modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") { e.preventDefault(); setWatchlistOpen((v) => !v); return; }
      if (e.key === "b" || e.key === "B") setSide("BUY");
      else if (e.key === "s" || e.key === "S") setSide("SELL");
      else if (e.key === "f" || e.key === "F") setFullScreen((v) => !v);
      else if (e.key === "Escape") {
        setFullScreen(false);
        setConfirmPending(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const instrument = getInstrumentById(selectedId);
  const quote = quotes[instrument.id];
  const isDerivative =
    instrument.segment === "NSE_FUTURES" ||
    instrument.segment === "NSE_OPTIONS" ||
    instrument.segment === "MCX_COMMODITY" ||
    instrument.segment === "NSE_CURRENCY";
  const effectiveProduct: ProductType = isDerivative ? "NRML" : product;
  const availableStrategies = effectiveProduct === "DELIVERY"
    ? STRATEGY_TAGS.filter((s) => s !== "Intraday Breakout")
    : STRATEGY_TAGS;
  useEffect(() => {
    if (effectiveProduct === "DELIVERY" && strategy === "Intraday Breakout") {
      setStrategy("Positional / Delivery");
    }
  }, [effectiveProduct, strategy]);

  const baseCandles = useMemo(
    () => generateCandles(instrument, undefined, timeframe, 56),
    [instrument, timeframe]
  );
  const candles = useMemo(
    () => (quote ? updateLatestCandle(baseCandles, quote.last, quote.volume) : baseCandles),
    [baseCandles, quote]
  );
  const indicators = useMemo(() => computeIndicators(candles), [candles]);
  const secondaryCandles = useMemo(
    () => (splitLayout ? generateCandles(instrument, quote, secondaryTf, 42) : []),
    [splitLayout, instrument, quote, secondaryTf]
  );
  const secondaryInd = useMemo(
    () => (splitLayout ? computeIndicators(secondaryCandles) : null),
    [splitLayout, secondaryCandles]
  );
  const depth = useMemo(
    () => generateMarketDepth(instrument, quote, depthLevels),
    [instrument, quote, depthLevels]
  );

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

  const ownedOppositePos = useMemo(
    () =>
      account.positions.find(
        (p) => p.instrumentId === instrument.id && p.side === (side === "BUY" ? "SELL" : "BUY") && p.product === effectiveProduct
      ) ??
      (side === "SELL" ? account.positions.find((p) => p.instrumentId === instrument.id && p.side === "BUY") : undefined),
    [account.positions, instrument.id, side, effectiveProduct]
  );
  const isClosingOwned = Boolean(ownedOppositePos && quantity <= ownedOppositePos.quantity);
  const requiredMargin = isClosingOwned
    ? 0
    : computeRequiredMargin(instrument, effectiveProduct, side, activePrice, quantity);

  // Clear stale Limit/SL/Target prices when switching instruments
  useEffect(() => {
    setLimitPrice("");
    setTriggerPrice("");
    setStopLossPrice("");
    setTargetPrice("");
    setQtyHint("");
  }, [instrument.id]);
  const estCharges = calculateIndianCharges({
    segment: instrument.segment,
    product: effectiveProduct,
    side,
    price: activePrice,
    quantity,
    brokeragePlan: account.brokeragePlan,
  });

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
    if (sized.recommendedLots >= 1) { setLots(sized.recommendedLots); setQtyInput(String(sized.recommendedLots)); setQtyHint(""); }
  }

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
    if (sized.recommendedLots >= 1) { setLots(sized.recommendedLots); setQtyInput(String(sized.recommendedLots)); setQtyHint(""); }
    if (!rationale.trim()) setRationale(`Rule-based ${strategy}: 1% risk sizing, 1:2 R:R`);
    if (["FOMO", "Revenge", "Greedy", "Fearful"].includes(emotion)) setEmotion("Disciplined");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nowMs = Date.now();
    if (nowMs - lastSubmitRef.current < 350) return;
    lastSubmitRef.current = nowMs;
    const payload: PlaceOrderInput = {
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
      confidenceLevel,
      regime,
      rationale,
    };
    if (account.confirmBeforeOrder) {
      setConfirmPending(payload);
      return;
    }
    onPlaceOrder(payload);
    setRationale("");
  }

  const inWatchlist = account.watchlist.includes(instrument.id);
  const latestRsi = indicators.rsi14[indicators.rsi14.length - 1];

  return (
    <div className={`nt-terminal-wrap${fullScreen ? " nt-fullscreen" : ""}`}>
      {/* Market Regime & Data Source Clarity Banner */}
      <section className="surface-card nt-regime-bar">
        <div className="nt-regime-left">
          <div className="nt-inline-actions">
            <button
              type="button"
              className={`nt-pill${watchlistOpen ? " active" : ""}`}
              onClick={() => setWatchlistOpen((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <NavIcon name="Search" size={14} />
              {watchlistOpen ? "Hide Watchlist (/)" : "Watchlist / Search (/)"}
            </button>
            <span className="nt-free-badge">SIMULATED EXECUTION · ZERO REAL MONEY</span>
            <span className="source-tag">Shortcuts: / (Search) · B · S · F</span>
          </div>
          <div className="nt-pill-row">
            {(Object.keys(REGIME_META) as MarketRegime[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`nt-pill${regime === key ? " active" : ""}`}
                onClick={() => onChangeRegime(key)}
              >
                {REGIME_META[key].label}
              </button>
            ))}
          </div>
        </div>
        <div className="nt-regime-right">
          <button type="button" className="nt-pill" onClick={() => setSplitLayout((v) => !v)}>
            {splitLayout ? "Single Chart" : "Split 2-Chart"}
          </button>
          <button type="button" className="nt-pill" onClick={() => setFullScreen((v) => !v)}>
            {fullScreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F)"}
          </button>
          <button type="button" className="primary-button" onClick={onToggleSim}>
            {simRunning ? "Pause Ticks" : "Resume Ticks"}
          </button>
        </div>
      </section>

      <div className={`nt-terminal-grid ${watchlistOpen && !fullScreen && !splitLayout ? "tg-with-drawer" : "tg-two-col"}`}>
        {/* Collapsible Left Drawer: Market Watch (toggle via "/" or header button) */}
        {watchlistOpen && !fullScreen && !splitLayout && (
          <aside className="surface-card nt-market-watch">
            <div className="card-heading">
              <div>
                <span className="card-kicker">INSTRUMENTS</span>
                <h2>Market Watch</h2>
              </div>
              <span className="source-tag">{filteredInstruments.length}</span>
            </div>
            <input
              className="nt-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search NSE, BSE, F&O, MCX…"
            />
            <div className="nt-segment-tabs">
              <button type="button" className={`nt-seg-tab${segmentFilter === "ALL" ? " active" : ""}`} onClick={() => setSegmentFilter("ALL")}>
                All
              </button>
              {(Object.keys(SEGMENT_LABELS) as MarketSegment[]).map((seg) => (
                <button key={seg} type="button" className={`nt-seg-tab${segmentFilter === seg ? " active" : ""}`} onClick={() => setSegmentFilter(seg)}>
                  {SEGMENT_LABELS[seg]}
                </button>
              ))}
            </div>
            <div className="nt-watch-list">
              {filteredInstruments.length === 0 ? (
                <div className="nt-watch-empty" role="status">
                  <span>No instruments match &ldquo;{search || segmentFilter}&rdquo;</span>
                  <button
                    type="button"
                    className="nt-pill"
                    onClick={() => {
                      setSearch("");
                      setSegmentFilter("ALL");
                    }}
                  >
                    Clear search
                  </button>
                </div>
              ) : filteredInstruments.map((item) => {
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
                      setHLines([]);
                      setTrendLines([]);
                    }}
                  >
                    <div className="nt-watch-sym">
                      <strong>{getDynamicInstrumentDisplay(item, quotes).symbol}</strong>
                      <small>{item.exchange} · Lot {item.lotSize}</small>
                    </div>
                    <div className="nt-watch-price">
                      <strong>₹{(q?.last ?? item.basePrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                      <small className={up ? "nt-pos" : "nt-neg"}>
                        {up ? "+" : ""}{q?.changePercent.toFixed(2)}%
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Center: Professional Candlestick Chart + Indicators + Drawing Tools + 10-Level Market Depth */}
        <section className="surface-card nt-chart-stage">
          <div className="card-heading">
            <div>
              <span className="card-kicker">{instrument.exchange} · {SEGMENT_LABELS[instrument.segment]} · {instrument.sector}</span>
              <h2>{getDynamicInstrumentDisplay(instrument, quotes).symbol} — {getDynamicInstrumentDisplay(instrument, quotes).name}</h2>
            </div>
            <div className="nt-inline-actions">
              <button type="button" className="nt-pill" onClick={() => onToggleWatchlist(instrument.id)}>
                {inWatchlist ? "★ Saved" : "☆ Watch"}
              </button>
              <button type="button" className={`nt-pill${chartMode === "CANDLES" ? " active" : ""}`} onClick={() => setChartMode("CANDLES")}>
                Pro Candles
              </button>
              <button type="button" className={`nt-pill${chartMode === "TV" ? " active" : ""}`} onClick={() => setChartMode("TV")}>
                TradingView
              </button>
            </div>
          </div>

          {/* 10 Timeframes + Indicator Toggles + Drawing Tools */}
          {chartMode === "CANDLES" && (
            <div className="nt-chain-toolbar">
              <div className="nt-inline-actions">
                {CHART_TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`nt-seg-tab${timeframe === tf ? " active" : ""}`}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="nt-inline-actions">
                <button type="button" className={`nt-seg-tab${showEma ? " active" : ""}`} onClick={() => setShowEma((v) => !v)}>EMA 9/21</button>
                <button type="button" className={`nt-seg-tab${showSma ? " active" : ""}`} onClick={() => setShowSma((v) => !v)}>SMA 20</button>
                <button type="button" className={`nt-seg-tab${showBb ? " active" : ""}`} onClick={() => setShowBb((v) => !v)}>BB</button>
                <button type="button" className={`nt-seg-tab${showSr ? " active" : ""}`} onClick={() => setShowSr((v) => !v)}>S&amp;R</button>
                <button type="button" className={`nt-seg-tab${showRsi ? " active" : ""}`} onClick={() => setShowRsi((v) => !v)}>RSI</button>
                <button type="button" className={`nt-seg-tab${drawTool === "HLINE" ? " active" : ""}`} onClick={() => setDrawTool(drawTool === "HLINE" ? "NONE" : "HLINE")}>
                  + H-Line
                </button>
                <button type="button" className={`nt-seg-tab${drawTool === "TRENDLINE" ? " active" : ""}`} onClick={() => { setPendingTrendStart(null); setDrawTool(drawTool === "TRENDLINE" ? "NONE" : "TRENDLINE"); }}>
                  + Trendline
                </button>
                {(hLines.length > 0 || trendLines.length > 0) && (
                  <button type="button" className="nt-seg-tab" onClick={() => { setHLines([]); setTrendLines([]); setPendingTrendStart(null); }}>
                    Clear Drawings
                  </button>
                )}
              </div>
            </div>
          )}

          {quote && (
            <div className="nt-quote-strip">
              <div>
                <span className="nt-kicker-xs">SIMULATED LIVE QUOTE</span>
                <strong className="nt-ltp">₹{quote.last.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                <span className={`nt-delta ${quote.change >= 0 ? "nt-pos" : "nt-neg"}`}>
                  {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="nt-quote-meta">
                <span>Bid: <b>₹{quote.bid}</b></span>
                <span>Ask: <b>₹{quote.ask}</b></span>
                <span>RSI(14): <b>{latestRsi ?? "—"}</b></span>
                <span>Vol: <b>{(quote.volume / 1000).toFixed(1)}k</b></span>
              </div>
            </div>
          )}

          {chartMode === "CANDLES" ? (
            <div className={splitLayout ? "nt-split-charts" : ""}>
              <ProCandlestickSvg
                candles={candles}
                indicators={indicators}
                showEma={showEma}
                showSma={showSma}
                showBb={showBb}
                showSr={showSr}
                showRsi={showRsi}
                stopLoss={Number(stopLossPrice) > 0 ? Number(stopLossPrice) : undefined}
                target={Number(targetPrice) > 0 ? Number(targetPrice) : undefined}
                drawTool={drawTool}
                hLines={hLines}
                trendLines={trendLines}
                pendingTrendStart={pendingTrendStart}
                onAddHLine={(price) => setHLines((prev) => [...prev, price])}
                onTrendClick={(pt) => {
                  if (!pendingTrendStart) setPendingTrendStart(pt);
                  else {
                    setTrendLines((prev) => [...prev, { x1: pendingTrendStart.x, y1: pendingTrendStart.y, x2: pt.x, y2: pt.y }]);
                    setPendingTrendStart(null);
                  }
                }}
              />
              {splitLayout && secondaryInd && (
                <div>
                  <div className="nt-inline-actions" style={{ marginBottom: 6 }}>
                    <span className="card-kicker">SECONDARY TIMEFRAME</span>
                    {CHART_TIMEFRAMES.slice(3, 9).map((tf) => (
                      <button key={tf} type="button" className={`nt-seg-tab${secondaryTf === tf ? " active" : ""}`} onClick={() => setSecondaryTf(tf)}>
                        {tf}
                      </button>
                    ))}
                  </div>
                  <ProCandlestickSvg
                    candles={secondaryCandles}
                    indicators={secondaryInd}
                    showEma={true}
                    showSma={false}
                    showBb={false}
                    showSr={true}
                    showRsi={false}
                    drawTool="NONE"
                    hLines={[]}
                    trendLines={[]}
                    pendingTrendStart={null}
                    onAddHLine={() => {}}
                    onTrendClick={() => {}}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={splitLayout ? "nt-split-charts" : ""}>
              <div className="nt-tv-box">
                <TradingViewWidget
                  key={`${instrument.tradingViewSymbol}-primary`}
                  kind="advanced-chart"
                  symbol={instrument.tradingViewSymbol}
                  interval="15"
                  title={`${instrument.symbol} primary chart`}
                  note="TradingView embeds show exchange-delayed data; order fills execute at the simulator quote above."
                />
              </div>
              {splitLayout && (
                <div className="nt-tv-box">
                  <TradingViewWidget
                    key={`${instrument.tradingViewSymbol}-secondary-60`}
                    kind="advanced-chart"
                    symbol={instrument.tradingViewSymbol}
                    interval="60"
                    title={`${instrument.symbol} 1H chart`}
                    note="Secondary 1H timeframe (TradingView delayed feed)."
                  />
                </div>
              )}
            </div>
          )}

          {/* Collapsible 5 / 10-Level Market Depth Ladder */}
          <div className="nt-depth-card">
            <div className="nt-inline-actions" style={{ justifyContent: "space-between", marginBottom: depthOpen ? 8 : 0 }}>
              <button
                type="button"
                className="nt-link-btn"
                onClick={() => setDepthOpen((v) => !v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#0f172a" }}
              >
                <span className="card-kicker" style={{ margin: 0 }}>Market Depth (Simulated)</span>
                <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>{depthOpen ? "Hide ▲" : "Show ▼"}</span>
              </button>
              {depthOpen && (
                <div className="nt-inline-actions">
                  <button type="button" className={`nt-seg-tab${depthLevels === 5 ? " active" : ""}`} onClick={() => setDepthLevels(5)}>5 Levels</button>
                  <button type="button" className={`nt-seg-tab${depthLevels === 10 ? " active" : ""}`} onClick={() => setDepthLevels(10)}>10 Levels</button>
                </div>
              )}
            </div>
            {depthOpen && (
            <div className="nt-depth-grid">
              <div>
                <div className="nt-depth-head"><span>BID QTY</span><span>ORDERS</span><span>BID PRICE</span></div>
                {depth.bids.map((b, i) => (
                  <div key={i} className="nt-depth-row bid" onClick={() => { setOrderType("LIMIT"); setLimitPrice(String(b.price)); }}>
                    <span>{b.qty}</span><span>{b.orders}</span><strong className="nt-pos">{formatINR(b.price)}</strong>
                  </div>
                ))}
                <div className="nt-depth-foot">Total Bid: <strong>{depth.totalBidQty.toLocaleString("en-IN")}</strong></div>
              </div>
              <div>
                <div className="nt-depth-head"><span>ASK PRICE</span><span>ORDERS</span><span>ASK QTY</span></div>
                {depth.asks.map((a, i) => (
                  <div key={i} className="nt-depth-row ask" onClick={() => { setOrderType("LIMIT"); setLimitPrice(String(a.price)); }}>
                    <strong className="nt-neg">{formatINR(a.price)}</strong><span>{a.orders}</span><span>{a.qty}</span>
                  </div>
                ))}
                <div className="nt-depth-foot">Total Ask: <strong>{depth.totalAskQty.toLocaleString("en-IN")}</strong></div>
              </div>
            </div>
            )}
          </div>
        </section>

        {/* Right: Order Execution Panel */}
        <aside className="surface-card nt-order-ticket">
          <div className="card-heading">
            <div>
              <span className="card-kicker">SIMULATED ORDER TICKET</span>
              <h2>{getDynamicInstrumentDisplay(instrument, quotes).symbol}</h2>
            </div>
            <span className="source-tag tabular-nums">Cash {formatINR(account.availableCash)}</span>
          </div>

          <div className="nt-side-toggle">
            <button type="button" className={`nt-side-btn buy${side === "BUY" ? " active" : ""}`} onClick={() => setSide("BUY")}>
              BUY
            </button>
            <button type="button" className={`nt-side-btn sell${side === "SELL" ? " active" : ""}`} onClick={() => setSide("SELL")}>
              SELL
            </button>
          </div>

          <form className="nt-order-form" onSubmit={handleSubmit}>
            {/* Unified Order Type Control (#5) + Validated Quantity Input (#18) */}
            <label>
              <span>
                Order Type
                <InfoTip
                  label="Order Type"
                  text="Market fills immediately; Limit waits for your target price; SL and SL-M activate when price crosses your Trigger Price."
                />
              </span>
              <div className="tg-mode-switch" style={{ width: "100%", justifyContent: "space-between", marginTop: 4 }}>
                {(["MARKET", "LIMIT", "SL", "SL-M"] as OrderType[]).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    className={`tg-mode-btn${orderType === ot ? " active" : ""}`}
                    style={{ flex: 1, whiteSpace: "nowrap" }}
                    onClick={() => setOrderType(ot)}
                  >
                    {ot === "MARKET" ? "Market" : ot === "LIMIT" ? "Limit" : ot}
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>{instrument.lotSize > 1 ? `Lots (×${instrument.lotSize} = ${quantity} qty)` : "Quantity (Shares)"}</span>
                {ownedOppositePos && side === "SELL" && (
                  <button
                    type="button"
                    className="nt-pill"
                    style={{ padding: "2px 8px", fontSize: 10 }}
                    onClick={() => {
                      const sellLots = Math.max(1, Math.floor(ownedOppositePos.quantity / instrument.lotSize));
                      setLots(sellLots);
                      setQtyInput(String(sellLots));
                      setQtyHint("");
                    }}
                  >
                    Sell All ({ownedOppositePos.quantity})
                  </button>
                )}
              </span>
              <input
                type="number"
                min={1}
                value={qtyInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setQtyInput(raw);
                  if (raw === "") {
                    setQtyHint("");
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n) || n < 1) {
                    setQtyHint(`Minimum quantity is 1 ${instrument.lotSize > 1 ? "lot" : "share"}.`);
                  } else {
                    setQtyHint("");
                    setLots(Math.floor(n));
                  }
                }}
                onBlur={() => {
                  const n = Number(qtyInput);
                  if (!Number.isFinite(n) || n < 1) {
                    setLots(1);
                    setQtyInput("1");
                    setQtyHint(`Minimum quantity is 1 ${instrument.lotSize > 1 ? "lot" : "share"}.`);
                  } else {
                    const clean = Math.floor(n);
                    setLots(clean);
                    setQtyInput(String(clean));
                    setQtyHint("");
                  }
                }}
              />
              {qtyHint && <small style={{ color: "#b91c1c", fontSize: 11, marginTop: 2, display: "block" }}>{qtyHint}</small>}
            </label>

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

            {/* Compact Order Summary */}
            <div className="nt-cost-preview">
              <div>
                <span>Estimated Value</span>
                <strong>{formatINR(quantity * (Number(limitPrice) > 0 ? Number(limitPrice) : (quote?.last ?? instrument.basePrice)))}</strong>
              </div>
              <div>
                <span>
                  Margin Blocked
                  <InfoTip
                    label="Margin Blocked"
                    text="The virtual cash temporarily reserved to open this trade (intraday requires less margin than full delivery)."
                  />
                </span>
                <strong className="tabular-nums">{isClosingOwned ? "₹0.00 (Exit)" : formatINR(requiredMargin)}</strong>
              </div>
            </div>

            <button type="submit" className={`nt-submit-order ${side === "BUY" ? "buy" : "sell"}`}>
              {side} {quantity} {getDynamicInstrumentDisplay(instrument, quotes).symbol} ({orderType})
            </button>

            {/* Progressive Disclosure: Advanced Options Accordion */}
            <div>
              <button
                type="button"
                className="tg-accordion-btn"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <span>Advanced Options (SL, Target, Product &amp; Taxes)</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{advancedOpen ? "▲" : "▼"}</span>
              </button>
              {advancedOpen && (
                <div className="tg-accordion-body">
                  <label>
                    Product Type
                    <select value={effectiveProduct} disabled={isDerivative} onChange={(e) => setProduct(e.target.value as ProductType)}>
                      {isDerivative ? (
                        <option value="NRML">NRML (Derivatives Margin)</option>
                      ) : (
                        <>
                          <option value="DELIVERY">Delivery (CNC)</option>
                          <option value="INTRADAY">Intraday (MIS · 5× Margin)</option>
                        </>
                      )}
                    </select>
                  </label>

                  {orderType === "AUTO-LIMIT" && (
                    <div className="nt-form-row">
                      <label>
                        Offset % ({side === "BUY" ? "below" : "above"} LTP)
                        <input type="number" step="0.1" min="0.1" value={autoOffsetPct} onChange={(e) => setAutoOffsetPct(Number(e.target.value) || 0.5)} />
                      </label>
                      <label>
                        Wait Window (min)
                        <input type="number" min={1} value={autoWaitMins} onChange={(e) => setAutoWaitMins(Number(e.target.value) || 5)} />
                      </label>
                    </div>
                  )}

                  <div className="nt-form-row">
                    <label>
                      Stop-Loss (₹)
                      <input
                        type="number"
                        step={instrument.tickSize}
                        required={orderType === "BRACKET" || orderType === "COVER"}
                        value={stopLossPrice}
                        onChange={(e) => setStopLossPrice(e.target.value)}
                        placeholder={`e.g. ${Math.round((quote?.last ?? instrument.basePrice) * (side === "BUY" ? 0.98 : 1.02))}`}
                      />
                    </label>
                    <label>
                      Target (₹)
                      <input
                        type="number"
                        step={instrument.tickSize}
                        required={orderType === "BRACKET"}
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder={`e.g. ${Math.round((quote?.last ?? instrument.basePrice) * (side === "BUY" ? 1.03 : 0.97))}`}
                      />
                    </label>
                  </div>

                  <div className="nt-risk-helper">
                    <span>Risk Sizer:</span>
                    <select value={riskPctHelper} onChange={(e) => setRiskPctHelper(Number(e.target.value))}>
                      <option value={0.5}>0.5%</option>
                      <option value={1}>1.0%</option>
                      <option value={2}>2.0%</option>
                    </select>
                    <button type="button" className="nt-pill" onClick={applyRiskSizing} disabled={!stopLossPrice}>Calc Qty</button>
                  </div>

                  <label>
                    Validity (Time in Force)
                    <select value={tif} onChange={(e) => setTif(e.target.value as TimeInForce)}>
                      <option value="DAY">DAY (Valid Today)</option>
                      <option value="GTC">GTC (Good Till Cancelled)</option>
                    </select>
                  </label>
                  <label>
                    Strategy Tag
                    <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyTag)}>
                      {availableStrategies.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>

                  <div className="nt-form-row">
                    <label>
                      Pre-Trade Emotion
                      <select value={emotion} onChange={(e) => setEmotion(e.target.value as EmotionTag)}>
                        {EMOTION_TAGS.map((em) => <option key={em} value={em}>{em}</option>)}
                      </select>
                    </label>
                    <label>
                      Entry Reasoning
                      <input type="text" maxLength={160} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why this setup?" />
                    </label>
                  </div>

                  {/* Detailed Indian Charges Breakdown with STT tooltip */}
                  <div className="nt-cost-preview" style={{ background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                    <div>
                      <span>
                        {estCharges.sttLabel}
                        <InfoTip
                          label="STT"
                          text="Securities Transaction Tax is a statutory Indian government levy charged on exchange equity and F&O trades."
                        />
                      </span>
                      <strong>{formatINR(estCharges.sttOrCtt)}</strong>
                    </div>
                    <div><span>Exchange + SEBI + Stamp</span><strong>{formatINR(estCharges.exchangeCharges + estCharges.sebiFees + estCharges.stampDuty)}</strong></div>
                    <div><span>GST (18%)</span><strong>{formatINR(estCharges.gst)}</strong></div>
                    <div><span>Total Est. Charges</span><strong>{formatINR(estCharges.totalCharges)}</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="nt-cost-preview" style={{ display: "none" }}>
              <div><span>Est. Charges</span><strong>{formatINR(estCharges.totalCharges)}</strong></div>
              <div><span>Notional</span><strong>₹{(activePrice * quantity).toLocaleString("en-IN")}</strong></div>
            </div>

            {teacherMode && teacherFeedback.length > 0 && (
              <div className="nt-guardrail-box">
                <div className="nt-guardrail-head">
                  <span className="card-kicker" style={{ color: "#17613f" }}>AI TEACHER CHECK</span>
                  <button type="button" className="nt-pill active" onClick={applyTeacherAutoFix}>Apply Teacher Fix</button>
                </div>
                {teacherFeedback.slice(0, 3).map((item) => (
                  <div key={item.id} className={`nt-guardrail-item ${item.level.toLowerCase()}`}>
                    <strong>{item.title}</strong>
                    <span>{item.improvement}</span>
                  </div>
                ))}
              </div>
            )}

          </form>
        </aside>
      </div>

      {/* Order Confirmation Modal (when enabled in Settings) */}
      {confirmPending && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmPending(null); }}>
          <section className="auth-modal" role="dialog" aria-modal="true">
            <span className="card-kicker">ORDER CONFIRMATION (SIMULATED)</span>
            <h2 style={{ margin: "6px 0 10px" }}>{confirmPending.side} {quantity} {getDynamicInstrumentDisplay(instrument, quotes).symbol}</h2>
            <p className="nt-prose">
              Type: <strong>{confirmPending.orderType}</strong> · Product: <strong>{confirmPending.product}</strong> · Est. Margin: <strong>{formatINR(requiredMargin)}</strong> · Est. Charges: <strong>{formatINR(estCharges.totalCharges)}</strong>.
            </p>
            <div className="nt-inline-actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onPlaceOrder(confirmPending);
                  setConfirmPending(null);
                  setRationale("");
                }}
              >
                Confirm Simulated Order
              </button>
              <button type="button" className="nt-pill" onClick={() => setConfirmPending(null)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const ProCandlestickSvg = memo(function ProCandlestickSvg({
  candles,
  indicators,
  showEma,
  showSma,
  showBb,
  showSr,
  showRsi,
  stopLoss,
  target,
  drawTool,
  hLines,
  trendLines,
  pendingTrendStart,
  onAddHLine,
  onTrendClick,
}: {
  candles: Candle[];
  indicators: IndicatorOverlay;
  showEma: boolean;
  showSma: boolean;
  showBb: boolean;
  showSr: boolean;
  showRsi: boolean;
  stopLoss?: number;
  target?: number;
  drawTool: DrawTool;
  hLines: number[];
  trendLines: TrendDrawing[];
  pendingTrendStart: { x: number; y: number } | null;
  onAddHLine: (price: number) => void;
  onTrendClick: (pt: { x: number; y: number }) => void;
}) {
  const width = 700;
  const priceHeight = 250;
  const volHeight = 44;
  const rsiHeight = showRsi ? 54 : 0;
  const totalHeight = priceHeight + volHeight + rsiHeight + 18;
  const padL = 14;
  const padR = 58;
  const padT = 14;

  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  if (stopLoss) allPrices.push(stopLoss);
  if (target) allPrices.push(target);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const spanP = Math.max(maxP - minP, 0.05);
  const maxVol = Math.max(...candles.map((c) => c.volume), 1);

  const plotW = width - padL - padR;
  const barW = plotW / Math.max(1, candles.length);
  const toX = (i: number) => padL + i * barW + barW / 2;
  const toY = (p: number) => padT + ((maxP - p) / spanP) * (priceHeight - padT * 2);
  const yToPrice = (y: number) => Number((maxP - ((y - padT) / (priceHeight - padT * 2)) * spanP).toFixed(2));

  function buildSeriesPath(vals: Array<number | null>): string {
    return vals
      .map((v, i) => (v === null ? "" : `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drawTool === "NONE") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * totalHeight;
    if (y > priceHeight) return;
    if (drawTool === "HLINE") onAddHLine(yToPrice(y));
    else if (drawTool === "TRENDLINE") onTrendClick({ x, y });
  }

  return (
    <div className="nt-svg-chart-wrap" style={{ cursor: drawTool === "NONE" ? "default" : "crosshair" }}>
      <svg viewBox={`0 0 ${width} ${totalHeight}`} className="nt-svg-chart" onClick={handleSvgClick}>
        {/* Price grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + t * (priceHeight - padT * 2);
          const lbl = (maxP - t * spanP).toFixed(1);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#edf1ed" strokeDasharray="3 3" />
              <text x={width - padR + 5} y={y + 3} fontSize="8.5" fill="#7c8a80">{lbl}</text>
            </g>
          );
        })}

        {/* Auto Support & Resistance */}
        {showSr && indicators.supportLevels.map((s, idx) => (
          <line key={`sup-${idx}`} x1={padL} y1={toY(s)} x2={width - padR} y2={toY(s)} stroke="#17613f" strokeOpacity="0.35" strokeDasharray="6 4" />
        ))}
        {showSr && indicators.resistanceLevels.map((r, idx) => (
          <line key={`res-${idx}`} x1={padL} y1={toY(r)} x2={width - padR} y2={toY(r)} stroke="#b84739" strokeOpacity="0.35" strokeDasharray="6 4" />
        ))}

        {/* Bollinger Bands */}
        {showBb && (
          <>
            <polyline points={buildSeriesPath(indicators.bbUpper)} fill="none" stroke="#6d8f79" strokeWidth="1" strokeDasharray="3 2" />
            <polyline points={buildSeriesPath(indicators.bbLower)} fill="none" stroke="#6d8f79" strokeWidth="1" strokeDasharray="3 2" />
          </>
        )}

        {/* Candles + Volume */}
        {candles.map((c, i) => {
          const x = toX(i);
          const up = c.close >= c.open;
          const color = up ? "#17613f" : "#b84739";
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBot = toY(Math.min(c.open, c.close));
          const bodyH = Math.max(1.5, bodyBot - bodyTop);
          const cw = Math.max(2.5, barW * 0.62);
          const vh = (c.volume / maxVol) * (volHeight - 6);
          return (
            <g key={c.index}>
              <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth="1.1" />
              <rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} rx="0.8" />
              <rect x={x - cw / 2} y={priceHeight + volHeight - vh} width={cw} height={vh} fill={color} opacity="0.28" />
            </g>
          );
        })}

        {/* EMA & SMA Overlays */}
        {showEma && (
          <>
            <polyline points={buildSeriesPath(indicators.ema9)} fill="none" stroke="#2563eb" strokeWidth="1.3" />
            <polyline points={buildSeriesPath(indicators.ema21)} fill="none" stroke="#d97706" strokeWidth="1.3" />
          </>
        )}
        {showSma && <polyline points={buildSeriesPath(indicators.sma20)} fill="none" stroke="#7c3aed" strokeWidth="1.3" />}

        {/* Order SL & Target Lines */}
        {target && <line x1={padL} y1={toY(target)} x2={width - padR} y2={toY(target)} stroke="#17613f" strokeWidth="1.4" strokeDasharray="4 3" />}
        {stopLoss && <line x1={padL} y1={toY(stopLoss)} x2={width - padR} y2={toY(stopLoss)} stroke="#b84739" strokeWidth="1.4" strokeDasharray="4 3" />}

        {/* User Drawn Horizontal Lines & Trendlines */}
        {hLines.map((p, i) => (
          <g key={`hl-${i}`}>
            <line x1={padL} y1={toY(p)} x2={width - padR} y2={toY(p)} stroke="#0f766e" strokeWidth="1.4" />
            <text x={padL + 4} y={toY(p) - 3} fontSize="8.5" fill="#0f766e" fontWeight="700">₹{p}</text>
          </g>
        ))}
        {trendLines.map((t, i) => (
          <line key={`tl-${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#0f766e" strokeWidth="1.7" />
        ))}
        {pendingTrendStart && <circle cx={pendingTrendStart.x} cy={pendingTrendStart.y} r="3.5" fill="#0f766e" />}

        {/* RSI 14 Sub-Panel */}
        {showRsi && (
          <g transform={`translate(0, ${priceHeight + volHeight + 8})`}>
            <line x1={padL} y1={0} x2={width - padR} y2={0} stroke="#e2e8e3" />
            <line x1={padL} y1={14} x2={width - padR} y2={14} stroke="#f0d4d0" strokeDasharray="2 2" />
            <line x1={padL} y1={36} x2={width - padR} y2={36} stroke="#d0e8d7" strokeDasharray="2 2" />
            <text x={width - padR + 5} y={17} fontSize="8" fill="#8b968e">RSI 70</text>
            <text x={width - padR + 5} y={39} fontSize="8" fill="#8b968e">RSI 30</text>
            <polyline
              points={indicators.rsi14
                .map((v, i) => (v === null ? "" : `${toX(i).toFixed(1)},${(48 - (v / 100) * 44).toFixed(1)}`))
                .filter(Boolean)
                .join(" ")}
              fill="none"
              stroke="#17613f"
              strokeWidth="1.4"
            />
          </g>
        )}
      </svg>
    </div>
  );
});
