/**
 * @module lib/paper-engine
 * @description Core simulated Indian paper trading execution engine (default ₹10,00,000 virtual capital).
 *
 * Supported Order Lifecycle:
 * - Order types: MARKET, LIMIT, AUTO-LIMIT (offset % + wait window), SL, SL-M, BRACKET (OCO SL+Target), COVER.
 * - Product modes: Intraday (MIS), Delivery (CNC), Derivatives Margin (NRML) with DAY & GTC validity.
 * - Risk & Integrity: Enforces buying power, short-selling rules, partial fills, immutable audit/journal history,
 *   and safe automatic/manual ₹10,00,000 refills that resolve open exposure without ever deleting past records.
 */

import {
  calculateIndianCharges,
  calculateRoundTripCharges,
  type BrokeragePlan,
  type ProductType,
} from "./indian-charges";
import {
  getInstrumentById,
  roundToTick,
  type LiveQuote,
  type MarketRegime,
  type PaperInstrument,
} from "./paper-instruments";

export const DEFAULT_VIRTUAL_CAPITAL = 1000000; // ₹10,00,000 default

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "AUTO-LIMIT" | "SL" | "SL-M" | "BRACKET" | "COVER";
export type TimeInForce = "DAY" | "GTC";
export type OrderStatus = "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";

export type StrategyTag =
  | "Intraday Breakout"
  | "Scalping"
  | "VWAP Trend"
  | "RSI / MACD Momentum"
  | "Swing Setup"
  | "Positional / Fundamental"
  | "Options Strategy"
  | "Commodity / Currency"
  | "Algo Forward-Test"
  | "No Strategy (Impulse)";

export type EmotionTag = "Disciplined" | "Calm" | "Confident" | "FOMO" | "Hesitant" | "Revenge" | "Fearful" | "Greedy";

export const STRATEGY_TAGS: StrategyTag[] = [
  "Intraday Breakout",
  "Scalping",
  "VWAP Trend",
  "RSI / MACD Momentum",
  "Swing Setup",
  "Positional / Fundamental",
  "Options Strategy",
  "Commodity / Currency",
  "Algo Forward-Test",
  "No Strategy (Impulse)",
];

export const EMOTION_TAGS: EmotionTag[] = [
  "Disciplined",
  "Calm",
  "Confident",
  "FOMO",
  "Hesitant",
  "Revenge",
  "Fearful",
  "Greedy",
];

export const ACCOUNT_CHALLENGES = [
  { id: "standard_10l", name: "Standard Virtual Account (Default)", capital: 1000000, description: "Default ₹10,00,000 paper trading balance for full NSE/BSE/F&O/MCX practice." },
  { id: "starter_1l", name: "₹1 Lakh Retail Starter Challenge", capital: 100000, description: "Build strict 1% risk discipline on a realistic beginner retail balance." },
  { id: "swing_5l", name: "₹5 Lakh Swing Mastery Challenge", capital: 500000, description: "Ideal for testing multi-day equity swing and intraday breakout systems." },
  { id: "pro_25l", name: "₹25 Lakh Institutional Desk Challenge", capital: 2500000, description: "Practice multi-leg hedged options baskets and portfolio sector limits." },
];

export type PaperOrder = {
  id: string;
  instrumentId: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  orderType: OrderType;
  product: ProductType;
  tif: TimeInForce;
  quantity: number;
  filledQuantity: number;
  lots: number;
  limitPrice?: number;
  triggerPrice?: number;
  stopLossPrice?: number;
  targetPrice?: number;
  filledPrice?: number;
  slippageAmount: number;
  charges: number;
  status: OrderStatus;
  strategy: StrategyTag;
  emotion: EmotionTag;
  confidenceLevel: number; // 1..5
  regime: MarketRegime;
  rationale: string;
  expiresAt?: string;
  createdAt: string;
  filledAt?: string;
};

export type PaperPosition = {
  id: string;
  instrumentId: string;
  symbol: string;
  exchange: string;
  segment: PaperInstrument["segment"];
  side: OrderSide;
  product: ProductType;
  quantity: number;
  lots: number;
  entryPrice: number;
  stopLossPrice?: number;
  targetPrice?: number;
  marginBlocked: number;
  entryCharges: number;
  strategy: StrategyTag;
  emotion: EmotionTag;
  confidenceLevel: number;
  regime: MarketRegime;
  rationale: string;
  openedAt: string;
};

export type JournalTrade = {
  id: string;
  instrumentId: string;
  symbol: string;
  exchange: string;
  segment: PaperInstrument["segment"];
  side: OrderSide;
  product: ProductType;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  plannedStopLoss?: number;
  plannedTarget?: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  exitReason: "MANUAL" | "TARGET_HIT" | "STOP_LOSS_HIT" | "AUTO_REFILL_LIQUIDATION";
  followedStopLoss: boolean;
  strategy: StrategyTag;
  emotion: EmotionTag;
  postEmotion?: EmotionTag;
  confidenceLevel: number;
  regime: MarketRegime;
  rationale: string;
  exitReasoning?: string;
  reflection: string;
  screenshotNote?: string;
  openedAt: string;
  closedAt: string;
};

export type PriceAlert = {
  id: string;
  instrumentId: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  note: string;
  active: boolean;
  triggeredAt?: string;
  createdAt: string;
};

export type RefillEvent = {
  id: string;
  date: string;
  mode: "AUTO" | "MANUAL" | "CHALLENGE_SWITCH";
  reason: string;
  balanceBefore: number;
  amountAdded: number;
  balanceAfter: number;
  closedPositionsCount: number;
  cancelledOrdersCount: number;
};

export type RiskLimitsConfig = {
  maxRiskPerTradePct: number;
  maxDailyLossAmount: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
  maxOpenPositions: number;
  maxSectorExposurePct: number;
};

export type NotificationCategory =
  | "ORDER"
  | "ALERT"
  | "RISK"
  | "TEACHER"
  | "REFILL"
  | "ACADEMY"
  | "CHALLENGE";

export type AppNotification = {
  id: string;
  dedupeKey?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type NotificationPrefs = {
  priceAlerts: boolean;
  orderExecutions: boolean;
  riskWarnings: boolean;
  teacherFeedback: boolean;
  refillNotices: boolean;
  emailDigestEnabled: boolean;
};

export type PsychologyLog = {
  id: string;
  date: string;
  fearScore: number; // 1..5
  greedScore: number; // 1..5
  stressScore: number; // 1..5
  patienceScore: number; // 1..5
  dailyReflection: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
};

export type AdminConfig = {
  defaultVirtualCapital: number;
  autoRefillThreshold: number;
  autoRefillEnabled: boolean;
  announcements: string[];
  auditLog: AuditLogEntry[];
};

export type PaperAccountState = {
  startingCapital: number;
  challengeId: string;
  availableCash: number;
  brokeragePlan: BrokeragePlan;
  simulateSlippage: boolean;
  slippageBps: number;
  confirmBeforeOrder: boolean;
  autoRefillEnabled: boolean;
  autoRefillThreshold: number;
  resetCount: number;
  refillHistory: RefillEvent[];
  positions: PaperPosition[];
  orders: PaperOrder[];
  journal: JournalTrade[];
  alerts: PriceAlert[];
  watchlist: string[];
  riskLimits: RiskLimitsConfig;
  notifications: AppNotification[];
  notificationPrefs: NotificationPrefs;
  completedCourseIds: string[];
  quizScores: Record<string, number>;
  psychologyLogs: PsychologyLog[];
  adminConfig: AdminConfig;
  prerequisites: {
    dematAccount: boolean;
    sebiBroker: boolean;
    linkedBank: boolean;
    kycComplete: boolean;
    derivativesIncomeProof: boolean;
  };
};

export const DEFAULT_WATCHLIST = [
  "NSE:HINDUNILVR",
  "NSE:RELIANCE",
  "NSE:HDFCBANK",
  "NSE:TCS",
  "NFO:NIFTY-FUT",
  "NFO:NIFTY-24500-CE",
  "MCX:GOLDM-FUT",
  "CDS:USDINR-FUT",
];

export function createDefaultPaperState(
  startingCapital = DEFAULT_VIRTUAL_CAPITAL,
  challengeId = "standard_10l"
): PaperAccountState {
  return {
    startingCapital,
    challengeId,
    availableCash: startingCapital,
    brokeragePlan: "ZERO_BROKERAGE",
    simulateSlippage: true,
    slippageBps: 5,
    confirmBeforeOrder: false,
    autoRefillEnabled: true,
    autoRefillThreshold: 25000,
    resetCount: 0,
    refillHistory: [],
    positions: [],
    orders: [],
    journal: [],
    alerts: [],
    watchlist: [...DEFAULT_WATCHLIST],
    riskLimits: {
      maxRiskPerTradePct: 2,
      maxDailyLossAmount: Math.round(startingCapital * 0.03),
      maxDrawdownPct: 10,
      maxConsecutiveLosses: 3,
      maxOpenPositions: 6,
      maxSectorExposurePct: 35,
    },
    notifications: [
      {
        id: "NOTIF-WELCOME",
        dedupeKey: "welcome",
        category: "ACADEMY",
        title: "Welcome to TradeGuru AI (100% Free)",
        message: `Your ₹${startingCapital.toLocaleString("en-IN")} virtual trading account is ready. All market execution is simulated for education.`,
        read: false,
        createdAt: new Date().toISOString(),
      },
    ],
    notificationPrefs: {
      priceAlerts: true,
      orderExecutions: true,
      riskWarnings: true,
      teacherFeedback: true,
      refillNotices: true,
      emailDigestEnabled: false,
    },
    completedCourseIds: [],
    quizScores: {},
    psychologyLogs: [],
    adminConfig: {
      defaultVirtualCapital: DEFAULT_VIRTUAL_CAPITAL,
      autoRefillThreshold: 25000,
      autoRefillEnabled: true,
      announcements: [
        "TradeGuru AI is 100% Free Forever — zero subscriptions, zero brokerage fees, full educational access.",
      ],
      auditLog: [
        {
          id: "AUD-INIT",
          timestamp: new Date().toISOString(),
          actor: "System",
          action: "ACCOUNT_INITIALIZED",
          details: `Created default ₹${startingCapital.toLocaleString("en-IN")} virtual account with immutable history preservation.`,
        },
      ],
    },
    prerequisites: {
      dematAccount: false,
      sebiBroker: false,
      linkedBank: false,
      kycComplete: false,
      derivativesIncomeProof: false,
    },
  };
}

export function getStorageKey(userEmail?: string): string {
  return `tradeguru_ai_v3_${userEmail ? userEmail.toLowerCase() : "guest"}`;
}

export function loadPaperState(userEmail?: string): PaperAccountState {
  if (typeof window === "undefined") return createDefaultPaperState();
  try {
    const raw = window.localStorage.getItem(getStorageKey(userEmail));
    if (!raw) return createDefaultPaperState();
    const parsed = JSON.parse(raw) as Partial<PaperAccountState>;
    const defaults = createDefaultPaperState(parsed.startingCapital ?? DEFAULT_VIRTUAL_CAPITAL, parsed.challengeId);
    return {
      ...defaults,
      ...parsed,
      riskLimits: { ...defaults.riskLimits, ...(parsed.riskLimits ?? {}) },
      notificationPrefs: { ...defaults.notificationPrefs, ...(parsed.notificationPrefs ?? {}) },
      adminConfig: { ...defaults.adminConfig, ...(parsed.adminConfig ?? {}) },
      prerequisites: { ...defaults.prerequisites, ...(parsed.prerequisites ?? {}) },
    };
  } catch {
    return createDefaultPaperState();
  }
}

export function savePaperState(state: PaperAccountState, userEmail?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(userEmail), JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function pushNotification(
  state: PaperAccountState,
  notif: Omit<AppNotification, "id" | "read" | "createdAt">
): PaperAccountState {
  if (
    notif.dedupeKey &&
    state.notifications.some(
      (n) => n.dedupeKey === notif.dedupeKey && Date.now() - Date.parse(n.createdAt) < 120000
    )
  ) {
    return state;
  }
  const entry: AppNotification = {
    ...notif,
    id: `NTF-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    notifications: [entry, ...state.notifications].slice(0, 80),
  };
}

/**
 * Safely refills virtual capital by ₹10,00,000 (or custom challenge amount) while
 * PRESERVING ALL historical trades, reports, AI Teacher feedback, and previous stats!
 */
export function performSafeAccountRefill(
  state: PaperAccountState,
  quotes: Record<string, LiveQuote>,
  params: { mode: RefillEvent["mode"]; reason: string; addAmount?: number; challengeId?: string }
): PaperAccountState {
  let next = state;
  const closedPositionsCount = next.positions.length;
  const cancelledOrdersCount = next.orders.filter(
    (o) => o.status === "PENDING" || o.status === "PARTIALLY_FILLED"
  ).length;

  // 1. Safely liquidate open positions at current LTP into preserved journal
  for (const pos of [...next.positions]) {
    const ltp = quotes[pos.instrumentId]?.last ?? pos.entryPrice;
    next = closePaperPosition(next, pos.id, ltp, "AUTO_REFILL_LIQUIDATION").state;
  }

  // 2. Cancel all pending/partial orders
  next = {
    ...next,
    orders: next.orders.map((o) =>
      o.status === "PENDING" || o.status === "PARTIALLY_FILLED"
        ? { ...o, status: "CANCELLED" as const }
        : o
    ),
  };

  const addAmount = params.addAmount ?? DEFAULT_VIRTUAL_CAPITAL;
  const balanceBefore = round2(next.availableCash);
  const balanceAfter =
    params.mode === "CHALLENGE_SWITCH" ? addAmount : round2(Math.max(0, balanceBefore) + addAmount);
  const now = new Date().toISOString();

  const refillEvent: RefillEvent = {
    id: `RFL-${Date.now().toString(36).toUpperCase()}`,
    date: now,
    mode: params.mode,
    reason: params.reason,
    balanceBefore,
    amountAdded: addAmount,
    balanceAfter,
    closedPositionsCount,
    cancelledOrdersCount,
  };

  const auditEntry: AuditLogEntry = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    timestamp: now,
    actor: params.mode === "AUTO" ? "Auto-Refill Engine" : "Trader",
    action: `VIRTUAL_CAPITAL_${params.mode}`,
    details: `${params.reason} | Added ₹${addAmount.toLocaleString("en-IN")} | Preserved ${next.journal.length} historical trades.`,
  };

  next = {
    ...next,
    availableCash: balanceAfter,
    startingCapital: params.mode === "CHALLENGE_SWITCH" ? addAmount : next.startingCapital,
    challengeId: params.challengeId ?? next.challengeId,
    resetCount: next.resetCount + 1,
    refillHistory: [refillEvent, ...next.refillHistory],
    adminConfig: {
      ...next.adminConfig,
      auditLog: [auditEntry, ...next.adminConfig.auditLog].slice(0, 150),
    },
  };

  return pushNotification(next, {
    category: "REFILL",
    title: params.mode === "AUTO" ? "Automatic Virtual Capital Refill" : "Virtual Account Refilled",
    message: `Added ₹${addAmount.toLocaleString("en-IN")} (New cash ₹${balanceAfter.toLocaleString("en-IN")}). All ${next.journal.length} historical trades & AI Teacher records preserved.`,
  });
}

export function computeRequiredMargin(
  instrument: PaperInstrument,
  product: ProductType,
  side: OrderSide,
  price: number,
  quantity: number
): number {
  const notional = price * quantity;
  if (instrument.segment === "NSE_OPTIONS") {
    return side === "BUY" ? round2(notional) : round2(Math.max(notional * 4.5, 45000));
  }
  if (
    product === "DELIVERY" &&
    (instrument.segment === "NSE_EQUITY" ||
      instrument.segment === "BSE_EQUITY" ||
      instrument.segment === "ETF_GSEC")
  ) {
    return round2(notional);
  }
  return round2(notional * (instrument.marginPercent / 100));
}

export function computePositionPnl(position: PaperPosition, currentPrice: number): number {
  const diff = position.side === "BUY" ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
  return round2(diff * position.quantity);
}

export type PlaceOrderInput = {
  instrumentId: string;
  side: OrderSide;
  orderType: OrderType;
  product: ProductType;
  tif: TimeInForce;
  lots: number;
  limitPrice?: number;
  autoLimitOffsetPct?: number;
  autoLimitWaitMinutes?: number;
  triggerPrice?: number;
  stopLossPrice?: number;
  targetPrice?: number;
  strategy: StrategyTag;
  emotion: EmotionTag;
  confidenceLevel?: number;
  regime: MarketRegime;
  rationale: string;
};

export function placePaperOrder(
  state: PaperAccountState,
  input: PlaceOrderInput,
  quote: LiveQuote
): { state: PaperAccountState; message: string; ok: boolean } {
  const instrument = getInstrumentById(input.instrumentId);
  const lots = Math.max(1, Math.floor(input.lots));
  const quantity = lots * instrument.lotSize;

  if (input.orderType === "COVER" && !input.stopLossPrice) {
    return { state, ok: false, message: "Cover orders require a Stop-Loss price." };
  }
  if (input.orderType === "BRACKET" && (!input.stopLossPrice || !input.targetPrice)) {
    return { state, ok: false, message: "Bracket orders require both Stop-Loss and Target prices." };
  }
  if ((input.orderType === "LIMIT" || input.orderType === "SL") && (!input.limitPrice || input.limitPrice <= 0)) {
    return { state, ok: false, message: "Enter a valid Limit price." };
  }
  if ((input.orderType === "SL" || input.orderType === "SL-M") && (!input.triggerPrice || input.triggerPrice <= 0)) {
    return { state, ok: false, message: "Enter a valid Trigger price." };
  }
  if (
    input.side === "SELL" &&
    input.product === "DELIVERY" &&
    (instrument.segment === "NSE_EQUITY" || instrument.segment === "BSE_EQUITY")
  ) {
    const existingLong = state.positions.find(
      (p) => p.instrumentId === instrument.id && p.side === "BUY" && p.product === "DELIVERY"
    );
    if (!existingLong) {
      return {
        state,
        ok: false,
        message: "Short selling is allowed in Intraday (MIS) or F&O, not Delivery (CNC).",
      };
    }
  }

  const computedAutoLimitPrice =
    input.orderType === "AUTO-LIMIT"
      ? roundToTick(
          quote.last *
            (1 + ((input.side === "BUY" ? -1 : 1) * Math.max(0.1, input.autoLimitOffsetPct ?? 1)) / 100),
          instrument.tickSize
        )
      : undefined;

  const refPrice =
    input.orderType === "AUTO-LIMIT" && computedAutoLimitPrice
      ? computedAutoLimitPrice
      : input.orderType === "MARKET" || input.orderType === "BRACKET" || input.orderType === "COVER"
        ? input.side === "BUY"
          ? quote.ask
          : quote.bid
        : input.limitPrice ?? input.triggerPrice ?? quote.last;

  const requiredMargin = computeRequiredMargin(instrument, input.product, input.side, refPrice, quantity);
  const estCharges = calculateIndianCharges({
    segment: instrument.segment,
    product: input.product,
    side: input.side,
    price: refPrice,
    quantity,
    brokeragePlan: state.brokeragePlan,
  }).totalCharges;

  if (requiredMargin + estCharges > state.availableCash) {
    const rejectedState = pushNotification(state, {
      category: "ORDER",
      title: "Order Rejected — Insufficient Virtual Margin",
      message: `Need ₹${Math.round(requiredMargin + estCharges).toLocaleString("en-IN")} for ${quantity} ${instrument.symbol}, available ₹${Math.round(state.availableCash).toLocaleString("en-IN")}.`,
    });
    return {
      state: rejectedState,
      ok: false,
      message: `Insufficient virtual cash. Need ₹${(requiredMargin + estCharges).toLocaleString("en-IN")} (margin + charges), available ₹${state.availableCash.toLocaleString("en-IN")}.`,
    };
  }

  const now = new Date().toISOString();
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  const isMarketableLimit =
    input.orderType === "LIMIT" &&
    input.limitPrice !== undefined &&
    ((input.side === "BUY" && input.limitPrice >= quote.ask) ||
      (input.side === "SELL" && input.limitPrice <= quote.bid));

  const shouldFillNow =
    input.orderType === "MARKET" ||
    input.orderType === "BRACKET" ||
    input.orderType === "COVER" ||
    isMarketableLimit;

  if (!shouldFillNow) {
    const pendingOrder: PaperOrder = {
      id: orderId,
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      side: input.side,
      orderType: input.orderType,
      product: input.product,
      tif: input.tif,
      quantity,
      filledQuantity: 0,
      lots,
      limitPrice: input.orderType === "AUTO-LIMIT" ? computedAutoLimitPrice : input.limitPrice,
      triggerPrice: input.triggerPrice,
      stopLossPrice: input.stopLossPrice,
      targetPrice: input.targetPrice,
      slippageAmount: 0,
      charges: estCharges,
      status: "PENDING",
      strategy: input.strategy,
      emotion: input.emotion,
      confidenceLevel: input.confidenceLevel ?? 3,
      regime: input.regime,
      rationale: input.rationale.trim() || `${input.strategy} ${input.orderType} order`,
      expiresAt:
        input.orderType === "AUTO-LIMIT"
          ? new Date(Date.now() + Math.max(1, input.autoLimitWaitMinutes ?? 10) * 60000).toISOString()
          : undefined,
      createdAt: now,
    };

    const next = pushNotification(
      { ...state, orders: [pendingOrder, ...state.orders] },
      {
        category: "ORDER",
        title: `Pending ${input.orderType} Placed`,
        message: `${input.side} ${quantity} ${instrument.symbol} @ ₹${pendingOrder.limitPrice ?? pendingOrder.triggerPrice}`,
      }
    );

    return {
      state: next,
      ok: true,
      message: `${input.orderType} ${input.side} order queued for ${quantity} ${instrument.symbol} (${input.tif}).`,
    };
  }

  // Realistic Partial Fill simulation for large orders (>= 250 shares or >= 5 lots)
  const shouldPartialFill = (instrument.lotSize === 1 && quantity >= 250) || (instrument.lotSize > 1 && lots >= 5);
  const fillQty = shouldPartialFill ? Math.max(instrument.lotSize, Math.floor((quantity * 0.6) / instrument.lotSize) * instrument.lotSize) : quantity;

  return executeFill(state, {
    orderId,
    instrument,
    input,
    totalQuantity: quantity,
    fillQuantity: fillQty,
    lots,
    baseFillPrice: isMarketableLimit && input.limitPrice ? Math.min(input.limitPrice, quote.ask) : refPrice,
    now,
  });
}

function executeFill(
  state: PaperAccountState,
  params: {
    orderId: string;
    instrument: PaperInstrument;
    input: PlaceOrderInput;
    totalQuantity: number;
    fillQuantity: number;
    lots: number;
    baseFillPrice: number;
    now: string;
  }
): { state: PaperAccountState; message: string; ok: boolean } {
  const { orderId, instrument, input, totalQuantity, fillQuantity, lots, baseFillPrice, now } = params;
  const isPartial = fillQuantity < totalQuantity;
  const slipFactor = state.simulateSlippage ? state.slippageBps / 10000 : 0;
  const slippagePerUnit =
    input.orderType === "LIMIT" ? 0 : baseFillPrice * slipFactor * (input.side === "BUY" ? 1 : -1);
  const fillPrice = roundToTick(baseFillPrice + slippagePerUnit, instrument.tickSize);

  const charges = calculateIndianCharges({
    segment: instrument.segment,
    product: input.product,
    side: input.side,
    price: fillPrice,
    quantity: fillQuantity,
    brokeragePlan: state.brokeragePlan,
  }).totalCharges;

  const marginBlocked = computeRequiredMargin(instrument, input.product, input.side, fillPrice, fillQuantity);

  const orderRecord: PaperOrder = {
    id: orderId,
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    side: input.side,
    orderType: input.orderType,
    product: input.product,
    tif: input.tif,
    quantity: totalQuantity,
    filledQuantity: fillQuantity,
    lots,
    limitPrice: input.limitPrice ?? fillPrice,
    triggerPrice: input.triggerPrice,
    stopLossPrice: input.stopLossPrice,
    targetPrice: input.targetPrice,
    filledPrice: fillPrice,
    slippageAmount: round2(Math.abs(fillPrice - baseFillPrice) * fillQuantity),
    charges,
    status: isPartial ? "PARTIALLY_FILLED" : "FILLED",
    strategy: input.strategy,
    emotion: input.emotion,
    confidenceLevel: input.confidenceLevel ?? 3,
    regime: input.regime,
    rationale: input.rationale.trim() || `${input.strategy} entry`,
    createdAt: now,
    filledAt: now,
  };

  const position: PaperPosition = {
    id: `POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    segment: instrument.segment,
    side: input.side,
    product: input.product,
    quantity: fillQuantity,
    lots: Math.max(1, Math.round(fillQuantity / instrument.lotSize)),
    entryPrice: fillPrice,
    stopLossPrice: input.stopLossPrice,
    targetPrice: input.targetPrice,
    marginBlocked,
    entryCharges: charges,
    strategy: input.strategy,
    emotion: input.emotion,
    confidenceLevel: input.confidenceLevel ?? 3,
    regime: input.regime,
    rationale: orderRecord.rationale,
    openedAt: now,
  };

  let next: PaperAccountState = {
    ...state,
    availableCash: round2(state.availableCash - marginBlocked - charges),
    positions: [position, ...state.positions],
    orders: [orderRecord, ...state.orders],
  };

  next = pushNotification(next, {
    category: "ORDER",
    title: isPartial ? "Partial Order Execution" : "Simulated Order Executed",
    message: isPartial
      ? `Partially filled ${fillQuantity}/${totalQuantity} ${instrument.symbol} @ ₹${fillPrice}. Remaining ${totalQuantity - fillQuantity} working in book.`
      : `Filled ${input.side} ${fillQuantity} ${instrument.symbol} @ ₹${fillPrice} (Est. charges ₹${charges}).`,
  });

  return {
    state: next,
    ok: true,
    message: isPartial
      ? `Partial fill: ${fillQuantity}/${totalQuantity} ${instrument.symbol} @ ₹${fillPrice}. Remainder queued.`
      : `Filled ${input.side} ${fillQuantity} ${instrument.symbol} @ ₹${fillPrice.toLocaleString("en-IN")} (Charges ₹${charges}).`,
  };
}

export function closePaperPosition(
  state: PaperAccountState,
  positionId: string,
  exitPrice: number,
  exitReason: JournalTrade["exitReason"] = "MANUAL"
): { state: PaperAccountState; trade?: JournalTrade } {
  const pos = state.positions.find((p) => p.id === positionId);
  if (!pos) return { state };

  const instrument = getInstrumentById(pos.instrumentId);
  const exitSide: OrderSide = pos.side === "BUY" ? "SELL" : "BUY";
  const exitCharges = calculateIndianCharges({
    segment: instrument.segment,
    product: pos.product,
    side: exitSide,
    price: exitPrice,
    quantity: pos.quantity,
    brokeragePlan: state.brokeragePlan,
  }).totalCharges;

  const grossPnl = computePositionPnl(pos, exitPrice);
  const totalCharges = round2(pos.entryCharges + exitCharges);
  const netPnl = round2(grossPnl - totalCharges);
  const now = new Date().toISOString();

  const followedStopLoss =
    pos.stopLossPrice === undefined
      ? false
      : pos.side === "BUY"
        ? exitPrice >= pos.stopLossPrice * 0.992
        : exitPrice <= pos.stopLossPrice * 1.008;

  const journalEntry: JournalTrade = {
    id: `TRD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    instrumentId: pos.instrumentId,
    symbol: pos.symbol,
    exchange: pos.exchange,
    segment: pos.segment,
    side: pos.side,
    product: pos.product,
    quantity: pos.quantity,
    entryPrice: pos.entryPrice,
    exitPrice,
    plannedStopLoss: pos.stopLossPrice,
    plannedTarget: pos.targetPrice,
    grossPnl,
    charges: totalCharges,
    netPnl,
    exitReason,
    followedStopLoss,
    strategy: pos.strategy,
    emotion: pos.emotion,
    confidenceLevel: pos.confidenceLevel,
    regime: pos.regime,
    rationale: pos.rationale,
    exitReasoning: exitReason === "MANUAL" ? "Manual square-off" : exitReason.replaceAll("_", " "),
    reflection: "",
    openedAt: pos.openedAt,
    closedAt: now,
  };

  const exitOrder: PaperOrder = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    instrumentId: pos.instrumentId,
    symbol: pos.symbol,
    exchange: pos.exchange,
    side: exitSide,
    orderType: "MARKET",
    product: pos.product,
    tif: "DAY",
    quantity: pos.quantity,
    filledQuantity: pos.quantity,
    lots: pos.lots,
    filledPrice: exitPrice,
    slippageAmount: 0,
    charges: exitCharges,
    status: "FILLED",
    strategy: pos.strategy,
    emotion: pos.emotion,
    confidenceLevel: pos.confidenceLevel,
    regime: pos.regime,
    rationale: `Exit (${exitReason.replaceAll("_", " ")})`,
    createdAt: now,
    filledAt: now,
  };

  const nextCash = round2(state.availableCash + pos.marginBlocked + grossPnl - exitCharges);

  let next: PaperAccountState = {
    ...state,
    availableCash: nextCash,
    positions: state.positions.filter((p) => p.id !== positionId),
    orders: [exitOrder, ...state.orders],
    journal: [journalEntry, ...state.journal],
  };

  if (exitReason === "TARGET_HIT" || exitReason === "STOP_LOSS_HIT") {
    next = pushNotification(next, {
      category: "ORDER",
      title: exitReason === "TARGET_HIT" ? "Target Reached" : "Stop-Loss Triggered",
      message: `${pos.symbol} closed @ ₹${exitPrice} · Net P&L: ${netPnl >= 0 ? "+" : ""}₹${netPnl.toFixed(2)}`,
    });
  }

  return { state: next, trade: journalEntry };
}

export function processMarketTickOnAccount(
  state: PaperAccountState,
  quotes: Record<string, LiveQuote>
): { state: PaperAccountState; notifications: string[] } {
  let next = state;
  const notifications: string[] = [];

  // 1. Check open positions for SL / Target triggers
  for (const pos of [...next.positions]) {
    const q = quotes[pos.instrumentId];
    if (!q) continue;
    if (pos.side === "BUY") {
      if (pos.targetPrice !== undefined && q.bid >= pos.targetPrice) {
        const res = closePaperPosition(next, pos.id, pos.targetPrice, "TARGET_HIT");
        next = res.state;
        notifications.push(`Target hit: Closed ${pos.symbol} @ ₹${pos.targetPrice} (Net ₹${res.trade?.netPnl})`);
      } else if (pos.stopLossPrice !== undefined && q.bid <= pos.stopLossPrice) {
        const res = closePaperPosition(next, pos.id, pos.stopLossPrice, "STOP_LOSS_HIT");
        next = res.state;
        notifications.push(`Stop-loss triggered: Closed ${pos.symbol} @ ₹${pos.stopLossPrice} (Net ₹${res.trade?.netPnl})`);
      }
    } else {
      if (pos.targetPrice !== undefined && q.ask <= pos.targetPrice) {
        const res = closePaperPosition(next, pos.id, pos.targetPrice, "TARGET_HIT");
        next = res.state;
        notifications.push(`Target hit: Covered ${pos.symbol} @ ₹${pos.targetPrice} (Net ₹${res.trade?.netPnl})`);
      } else if (pos.stopLossPrice !== undefined && q.ask >= pos.stopLossPrice) {
        const res = closePaperPosition(next, pos.id, pos.stopLossPrice, "STOP_LOSS_HIT");
        next = res.state;
        notifications.push(`Stop-loss triggered: Covered ${pos.symbol} @ ₹${pos.stopLossPrice} (Net ₹${res.trade?.netPnl})`);
      }
    }
  }

  // 2. Complete any PARTIALLY_FILLED orders & check PENDING orders
  for (const ord of [...next.orders]) {
    const q = quotes[ord.instrumentId];
    if (!q) continue;

    if (ord.status === "PARTIALLY_FILLED" && ord.filledQuantity < ord.quantity) {
      const remQty = ord.quantity - ord.filledQuantity;
      const inst = getInstrumentById(ord.instrumentId);
      const execPrice = ord.side === "BUY" ? q.ask : q.bid;
      const addMargin = computeRequiredMargin(inst, ord.product, ord.side, execPrice, remQty);
      if (addMargin <= next.availableCash) {
        const now = new Date().toISOString();
        const addCharges = calculateIndianCharges({
          segment: inst.segment,
          product: ord.product,
          side: ord.side,
          price: execPrice,
          quantity: remQty,
          brokeragePlan: next.brokeragePlan,
        }).totalCharges;
        next = {
          ...next,
          availableCash: round2(next.availableCash - addMargin - addCharges),
          orders: next.orders.map((item) =>
            item.id === ord.id
              ? { ...item, filledQuantity: ord.quantity, status: "FILLED" as const, charges: round2(item.charges + addCharges), filledAt: now }
              : item
          ),
          positions: [
            {
              id: `POS-${Date.now().toString(36).toUpperCase()}-R`,
              instrumentId: inst.id,
              symbol: inst.symbol,
              exchange: inst.exchange,
              segment: inst.segment,
              side: ord.side,
              product: ord.product,
              quantity: remQty,
              lots: Math.max(1, Math.round(remQty / inst.lotSize)),
              entryPrice: execPrice,
              stopLossPrice: ord.stopLossPrice,
              targetPrice: ord.targetPrice,
              marginBlocked: addMargin,
              entryCharges: addCharges,
              strategy: ord.strategy,
              emotion: ord.emotion,
              confidenceLevel: ord.confidenceLevel,
              regime: ord.regime,
              rationale: `${ord.rationale} (Remainder fill)`,
              openedAt: now,
            },
            ...next.positions,
          ],
        };
        notifications.push(`Remainder filled: +${remQty} ${ord.symbol} @ ₹${execPrice}`);
      }
      continue;
    }

    if (ord.status !== "PENDING") continue;

    if (ord.expiresAt && Date.now() > Date.parse(ord.expiresAt)) {
      next = {
        ...next,
        orders: next.orders.map((item) => (item.id === ord.id ? { ...item, status: "CANCELLED" as const } : item)),
      };
      notifications.push(`Auto-Limit expired: ${ord.side} ${ord.symbol} cancelled after wait window.`);
      continue;
    }

    let triggered = false;
    let execPrice = q.last;

    if ((ord.orderType === "LIMIT" || ord.orderType === "AUTO-LIMIT") && ord.limitPrice !== undefined) {
      if (ord.side === "BUY" && q.ask <= ord.limitPrice) {
        triggered = true;
        execPrice = ord.limitPrice;
      } else if (ord.side === "SELL" && q.bid >= ord.limitPrice) {
        triggered = true;
        execPrice = ord.limitPrice;
      }
    } else if ((ord.orderType === "SL" || ord.orderType === "SL-M") && ord.triggerPrice !== undefined) {
      if (ord.side === "BUY" && q.last >= ord.triggerPrice) {
        triggered = true;
        execPrice = ord.orderType === "SL" && ord.limitPrice ? Math.min(ord.limitPrice, q.ask) : q.ask;
      } else if (ord.side === "SELL" && q.last <= ord.triggerPrice) {
        triggered = true;
        execPrice = ord.orderType === "SL" && ord.limitPrice ? Math.max(ord.limitPrice, q.bid) : q.bid;
      }
    }

    if (triggered) {
      const instrument = getInstrumentById(ord.instrumentId);
      const marginBlocked = computeRequiredMargin(instrument, ord.product, ord.side, execPrice, ord.quantity);
      const charges = calculateIndianCharges({
        segment: instrument.segment,
        product: ord.product,
        side: ord.side,
        price: execPrice,
        quantity: ord.quantity,
        brokeragePlan: next.brokeragePlan,
      }).totalCharges;

      if (marginBlocked + charges <= next.availableCash) {
        const now = new Date().toISOString();
        next = {
          ...next,
          availableCash: round2(next.availableCash - marginBlocked - charges),
          orders: next.orders.map((item) =>
            item.id === ord.id
              ? { ...item, status: "FILLED" as const, filledQuantity: ord.quantity, filledPrice: execPrice, charges, filledAt: now }
              : item
          ),
          positions: [
            {
              id: `POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
              instrumentId: instrument.id,
              symbol: instrument.symbol,
              exchange: instrument.exchange,
              segment: instrument.segment,
              side: ord.side,
              product: ord.product,
              quantity: ord.quantity,
              lots: ord.lots,
              entryPrice: execPrice,
              stopLossPrice: ord.stopLossPrice,
              targetPrice: ord.targetPrice,
              marginBlocked,
              entryCharges: charges,
              strategy: ord.strategy,
              emotion: ord.emotion,
              confidenceLevel: ord.confidenceLevel,
              regime: ord.regime,
              rationale: ord.rationale,
              openedAt: now,
            },
            ...next.positions,
          ],
        };
        notifications.push(`Pending ${ord.orderType} filled: ${ord.side} ${ord.quantity} ${ord.symbol} @ ₹${execPrice}`);
      }
    }
  }

  // 3. Check Price Alerts
  let alertsChanged = false;
  const updatedAlerts = next.alerts.map((alert) => {
    if (!alert.active) return alert;
    const q = quotes[alert.instrumentId];
    if (!q) return alert;
    const hit =
      (alert.condition === "ABOVE" && q.last >= alert.targetPrice) ||
      (alert.condition === "BELOW" && q.last <= alert.targetPrice);
    if (hit) {
      alertsChanged = true;
      notifications.push(`Price alert: ${alert.symbol} ${alert.condition.toLowerCase()} ₹${alert.targetPrice}`);
      return { ...alert, active: false, triggeredAt: new Date().toISOString() };
    }
    return alert;
  });
  if (alertsChanged) {
    next = { ...next, alerts: updatedAlerts };
  }

  // 4. Automatic Virtual Capital Refill Check when depleted
  if (next.autoRefillEnabled) {
    const usedMargin = next.positions.reduce((s, p) => s + p.marginBlocked, 0);
    const unreal = next.positions.reduce((s, p) => {
      const ltp = quotes[p.instrumentId]?.last ?? p.entryPrice;
      return s + computePositionPnl(p, ltp);
    }, 0);
    const totalEquity = next.availableCash + usedMargin + unreal;
    if (totalEquity <= next.autoRefillThreshold) {
      next = performSafeAccountRefill(next, quotes, {
        mode: "AUTO",
        reason: `Account equity (₹${Math.round(totalEquity).toLocaleString("en-IN")}) dropped below auto-refill threshold (₹${next.autoRefillThreshold.toLocaleString("en-IN")}).`,
        addAmount: DEFAULT_VIRTUAL_CAPITAL,
      });
      notifications.push(`Auto-Refill triggered: Added ₹10,00,000 while preserving all trade history.`);
    }
  }

  return { state: next, notifications };
}

export function buildRohitExampleJournal(brokeragePlan: BrokeragePlan): JournalTrade {
  const costs = calculateRoundTripCharges({
    segment: "NSE_EQUITY",
    product: "INTRADAY",
    buyPrice: 2200,
    sellPrice: 2255,
    quantity: 140,
    brokeragePlan,
  });
  const grossPnl = (2255 - 2200) * 140;
  const netPnl = round2(grossPnl - costs.totalCharges);
  const now = new Date().toISOString();
  return {
    id: `TRD-ROHIT-${Date.now().toString(36).toUpperCase()}`,
    instrumentId: "NSE:HINDUNILVR",
    symbol: "HINDUNILVR",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    side: "BUY",
    product: "INTRADAY",
    quantity: 140,
    entryPrice: 2200,
    exitPrice: 2255,
    plannedStopLoss: 2165,
    plannedTarget: 2255,
    grossPnl,
    charges: costs.totalCharges,
    netPnl,
    exitReason: "TARGET_HIT",
    followedStopLoss: true,
    strategy: "Intraday Breakout",
    emotion: "Disciplined",
    postEmotion: "Calm",
    confidenceLevel: 4,
    regime: "BULL",
    rationale: "Breakout above ₹2,180 resistance on volume; 1% risk sizing with 1:1.57 R:R.",
    exitReasoning: "Target ₹2,255 hit cleanly.",
    reflection: "Clean execution respecting position sizing rule and pre-planned target exit.",
    openedAt: now,
    closedAt: now,
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
