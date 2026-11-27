/**
 * @module lib/paper-instruments
 * @description Multi-segment Indian market instrument catalog (NSE/BSE Equities, F&O, MCX, Currency, ETFs)
 * and stochastic market regime simulator (`BULL`, `SIDEWAYS`, `CORRECTION`, `VOLATILITY`).
 *
 * Tick stepping respects segment-specific tick sizes (`roundToTick`) and regime drift/volatility profiles.
 */

export type MarketSegment =
  | "NSE_EQUITY"
  | "BSE_EQUITY"
  | "NSE_FUTURES"
  | "NSE_OPTIONS"
  | "MCX_COMMODITY"
  | "NSE_CURRENCY"
  | "ETF_GSEC";

export type MarketRegime = "BULL" | "SIDEWAYS" | "CORRECTION" | "VOLATILITY_SPIKE";

export type OptionGreeks = {
  delta: number;
  gamma: number;
  theta: number; // per day in INR
  vega: number;
  iv: number; // percentage e.g. 16.4
  daysToExpiry: number;
  strikePrice: number;
  optionType: "CE" | "PE";
  underlyingSymbol: string;
};

export type PaperInstrument = {
  id: string;
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE" | "MCX";
  segment: MarketSegment;
  sector: string;
  currency: "INR";
  lotSize: number;
  tickSize: number;
  marginPercent: number; // 100 for delivery, ~20 for intraday/futures, 100 for option buy
  basePrice: number;
  volatility: number; // per-tick fractional sigma
  spreadBps: number; // bid-ask spread in basis points
  tradingViewSymbol: string;
  expiryDate?: string;
  spotReference?: number;
  unitLabel?: string;
  greeks?: OptionGreeks;
};

export type LiveQuote = {
  instrumentId: string;
  last: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest?: number;
  history: number[];
  updatedAt: string;
};

export const SEGMENT_LABELS: Record<MarketSegment, string> = {
  NSE_EQUITY: "NSE Equities",
  BSE_EQUITY: "BSE Equities",
  NSE_FUTURES: "NSE Futures",
  NSE_OPTIONS: "NSE Options",
  MCX_COMMODITY: "MCX Commodities",
  NSE_CURRENCY: "Currency Derivatives",
  ETF_GSEC: "ETFs & G-Secs",
};

export const REGIME_META: Record<
  MarketRegime,
  { label: string; drift: number; volMultiplier: number; description: string }
> = {
  BULL: {
    label: "Trending Bull",
    drift: 0.00055,
    volMultiplier: 1.0,
    description: "Steady upward momentum across indices and large caps.",
  },
  SIDEWAYS: {
    label: "Sideways Consolidation",
    drift: 0.0,
    volMultiplier: 0.65,
    description: "Range-bound price action ideal for testing mean-reversion and false breakouts.",
  },
  CORRECTION: {
    label: "Sharp Correction",
    drift: -0.00075,
    volMultiplier: 1.35,
    description: "Broad sell-off testing stop-loss discipline and short-selling setups.",
  },
  VOLATILITY_SPIKE: {
    label: "RBI / Budget Volatility Spike",
    drift: 0.0001,
    volMultiplier: 2.25,
    description: "High-volatility swings simulating macro announcements, slippage, and IV expansion.",
  },
};

export const PAPER_INSTRUMENTS: PaperInstrument[] = [
  // NSE Cash Equities
  {
    id: "NSE:HINDUNILVR",
    symbol: "HINDUNILVR",
    name: "Hindustan Unilever Ltd (FMCG)",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "FMCG",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 2200.0,
    volatility: 0.0022,
    spreadBps: 4,
    tradingViewSymbol: "BSE:HINDUNILVR",
  },
  {
    id: "NSE:RELIANCE",
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "Energy & Telecom",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 1450.0,
    volatility: 0.0028,
    spreadBps: 4,
    tradingViewSymbol: "BSE:RELIANCE",
  },
  {
    id: "NSE:TCS",
    symbol: "TCS",
    name: "Tata Consultancy Services Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "IT Services",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 4120.0,
    volatility: 0.0024,
    spreadBps: 4,
    tradingViewSymbol: "BSE:TCS",
  },
  {
    id: "NSE:HDFCBANK",
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "Banking",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 1745.0,
    volatility: 0.0025,
    spreadBps: 3,
    tradingViewSymbol: "BSE:HDFCBANK",
  },
  {
    id: "NSE:INFY",
    symbol: "INFY",
    name: "Infosys Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "IT Services",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 1890.0,
    volatility: 0.0026,
    spreadBps: 4,
    tradingViewSymbol: "BSE:INFY",
  },
  {
    id: "NSE:ICICIBANK",
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "Banking",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 1295.0,
    volatility: 0.0027,
    spreadBps: 4,
    tradingViewSymbol: "BSE:ICICIBANK",
  },
  {
    id: "NSE:SBIN",
    symbol: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "PSU Banking",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 835.0,
    volatility: 0.0032,
    spreadBps: 5,
    tradingViewSymbol: "BSE:SBIN",
  },
  {
    id: "NSE:TATAMOTORS",
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd",
    exchange: "NSE",
    segment: "NSE_EQUITY",
    sector: "Automobiles",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 918.0,
    volatility: 0.0035,
    spreadBps: 6,
    tradingViewSymbol: "BSE:TATAMOTORS",
  },
  // BSE Cash Equities
  {
    id: "BSE:TITAN",
    symbol: "TITAN",
    name: "Titan Company Ltd (BSE)",
    exchange: "BSE",
    segment: "BSE_EQUITY",
    sector: "Consumer Durables",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 3460.0,
    volatility: 0.0029,
    spreadBps: 6,
    tradingViewSymbol: "BSE:TITAN",
  },
  {
    id: "BSE:MARUTI",
    symbol: "MARUTI",
    name: "Maruti Suzuki India Ltd (BSE)",
    exchange: "BSE",
    segment: "BSE_EQUITY",
    sector: "Automobiles",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.05,
    marginPercent: 20,
    basePrice: 12180.0,
    volatility: 0.0024,
    spreadBps: 5,
    tradingViewSymbol: "BSE:MARUTI",
  },
  // NSE Equity Futures
  {
    id: "NFO:NIFTY-FUT",
    symbol: "NIFTY FUT",
    name: "Nifty 50 Monthly Futures",
    exchange: "NSE",
    segment: "NSE_FUTURES",
    sector: "Index Derivatives",
    currency: "INR",
    lotSize: 75,
    tickSize: 0.05,
    marginPercent: 14, // SPAN + Exposure margin
    basePrice: 24560.0,
    spotReference: 24495.0,
    expiryDate: "Last Thu of Month",
    volatility: 0.0021,
    spreadBps: 3,
    tradingViewSymbol: "NSE:NIFTY",
  },
  {
    id: "NFO:BANKNIFTY-FUT",
    symbol: "BANKNIFTY FUT",
    name: "Bank Nifty Monthly Futures",
    exchange: "NSE",
    segment: "NSE_FUTURES",
    sector: "Index Derivatives",
    currency: "INR",
    lotSize: 30,
    tickSize: 0.05,
    marginPercent: 15,
    basePrice: 52180.0,
    spotReference: 52040.0,
    expiryDate: "Last Thu of Month",
    volatility: 0.0029,
    spreadBps: 4,
    tradingViewSymbol: "NSE:BANKNIFTY",
  },
  // NSE Equity Options
  {
    id: "NFO:NIFTY-24500-CE",
    symbol: "NIFTY 24500 CE",
    name: "Nifty 50 24500 Call Option",
    exchange: "NSE",
    segment: "NSE_OPTIONS",
    sector: "Index Options",
    currency: "INR",
    lotSize: 75,
    tickSize: 0.05,
    marginPercent: 100, // Full premium for buying; seller margin handled in engine
    basePrice: 184.5,
    expiryDate: "Weekly Thu",
    volatility: 0.0115,
    spreadBps: 18,
    tradingViewSymbol: "NSE:NIFTY",
    greeks: {
      delta: 0.54,
      gamma: 0.0014,
      theta: -16.8,
      vega: 11.2,
      iv: 14.2,
      daysToExpiry: 5,
      strikePrice: 24500,
      optionType: "CE",
      underlyingSymbol: "NIFTY 50",
    },
  },
  {
    id: "NFO:NIFTY-24500-PE",
    symbol: "NIFTY 24500 PE",
    name: "Nifty 50 24500 Put Option",
    exchange: "NSE",
    segment: "NSE_OPTIONS",
    sector: "Index Options",
    currency: "INR",
    lotSize: 75,
    tickSize: 0.05,
    marginPercent: 100,
    basePrice: 158.0,
    expiryDate: "Weekly Thu",
    volatility: 0.012,
    spreadBps: 18,
    tradingViewSymbol: "NSE:NIFTY",
    greeks: {
      delta: -0.46,
      gamma: 0.0014,
      theta: -15.4,
      vega: 11.0,
      iv: 14.8,
      daysToExpiry: 5,
      strikePrice: 24500,
      optionType: "PE",
      underlyingSymbol: "NIFTY 50",
    },
  },
  {
    id: "NFO:BANKNIFTY-52000-CE",
    symbol: "BANKNIFTY 52000 CE",
    name: "Bank Nifty 52000 Call Option",
    exchange: "NSE",
    segment: "NSE_OPTIONS",
    sector: "Index Options",
    currency: "INR",
    lotSize: 30,
    tickSize: 0.05,
    marginPercent: 100,
    basePrice: 412.0,
    expiryDate: "Monthly Thu",
    volatility: 0.0135,
    spreadBps: 20,
    tradingViewSymbol: "NSE:BANKNIFTY",
    greeks: {
      delta: 0.52,
      gamma: 0.0007,
      theta: -29.5,
      vega: 24.6,
      iv: 16.5,
      daysToExpiry: 7,
      strikePrice: 52000,
      optionType: "CE",
      underlyingSymbol: "BANKNIFTY",
    },
  },
  // MCX Commodities
  {
    id: "MCX:GOLDM-FUT",
    symbol: "GOLDM FUT",
    name: "MCX Gold Mini Futures (100g)",
    exchange: "MCX",
    segment: "MCX_COMMODITY",
    sector: "Bullion",
    currency: "INR",
    lotSize: 10, // Quoted per 10g, 100g lot = 10x quote
    tickSize: 1.0,
    marginPercent: 10,
    basePrice: 78450.0,
    unitLabel: "per 10g (100g lot)",
    expiryDate: "5th of Contract Month",
    volatility: 0.0019,
    spreadBps: 6,
    tradingViewSymbol: "TVC:GOLD",
  },
  {
    id: "MCX:CRUDEOIL-FUT",
    symbol: "CRUDEOIL FUT",
    name: "MCX Crude Oil Futures (100 bbl)",
    exchange: "MCX",
    segment: "MCX_COMMODITY",
    sector: "Energy",
    currency: "INR",
    lotSize: 100,
    tickSize: 1.0,
    marginPercent: 18,
    basePrice: 5980.0,
    unitLabel: "INR/barrel (100 bbl lot)",
    expiryDate: "19th of Contract Month",
    volatility: 0.0042,
    spreadBps: 8,
    tradingViewSymbol: "TVC:USOIL",
  },
  // NSE Currency Derivatives
  {
    id: "CDS:USDINR-FUT",
    symbol: "USDINR FUT",
    name: "USD/INR Currency Futures (1,000 USD)",
    exchange: "NSE",
    segment: "NSE_CURRENCY",
    sector: "Currency",
    currency: "INR",
    lotSize: 1000,
    tickSize: 0.0025,
    marginPercent: 5,
    basePrice: 84.425,
    unitLabel: "INR/USD (1,000 USD lot)",
    expiryDate: "2 working days before month-end",
    volatility: 0.0005,
    spreadBps: 2,
    tradingViewSymbol: "FX_IDC:USDINR",
  },
  // ETFs & G-Secs
  {
    id: "NSE:NIFTYBEES",
    symbol: "NIFTYBEES",
    name: "Nippon India ETF Nifty 50 BeES",
    exchange: "NSE",
    segment: "ETF_GSEC",
    sector: "Index ETF",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.01,
    marginPercent: 100,
    basePrice: 274.5,
    volatility: 0.0016,
    spreadBps: 4,
    tradingViewSymbol: "BSE:NIFTYBEES",
  },
  {
    id: "NSE:LIQUIDBEES",
    symbol: "LIQUIDBEES",
    name: "Nippon India ETF Liquid BeES (G-Sec / Cash)",
    exchange: "NSE",
    segment: "ETF_GSEC",
    sector: "Liquid / G-Sec",
    currency: "INR",
    lotSize: 1,
    tickSize: 0.01,
    marginPercent: 100,
    basePrice: 1000.0,
    volatility: 0.00005,
    spreadBps: 1,
    tradingViewSymbol: "BSE:LIQUIDBEES",
  },
];

export function roundToTick(price: number, tickSize: number): number {
  const rounded = Math.round(price / tickSize) * tickSize;
  const decimals = tickSize < 0.01 ? 4 : 2;
  return Number(Math.max(tickSize, rounded).toFixed(decimals));
}

export function createInitialQuotes(): Record<string, LiveQuote> {
  const quotes: Record<string, LiveQuote> = {};
  const now = new Date().toISOString();

  for (const inst of PAPER_INSTRUMENTS) {
    const history: number[] = [];
    let p = inst.basePrice * (1 - inst.volatility * 2);
    for (let i = 0; i < 36; i++) {
      const wave = Math.sin(i * 0.45 + inst.basePrice % 7) * inst.volatility * 0.85;
      p = roundToTick(p * (1 + wave + (i > 24 ? inst.volatility * 0.12 : 0)), inst.tickSize);
      history.push(p);
    }
    const last = inst.basePrice;
    history[history.length - 1] = last;
    const open = history[0];
    const high = Math.max(...history);
    const low = Math.min(...history);
    const halfSpread = last * (inst.spreadBps / 20000);
    const bid = roundToTick(last - halfSpread, inst.tickSize);
    const ask = roundToTick(last + halfSpread, inst.tickSize);
    const prevClose = roundToTick(open * 0.997, inst.tickSize);
    const change = Number((last - prevClose).toFixed(4));
    const changePercent = Number(((change / prevClose) * 100).toFixed(2));

    quotes[inst.id] = {
      instrumentId: inst.id,
      last,
      open,
      high,
      low,
      prevClose,
      bid,
      ask,
      change,
      changePercent,
      volume: Math.floor(120000 + (inst.basePrice * 137) % 850000),
      openInterest:
        inst.segment === "NSE_FUTURES" || inst.segment === "NSE_OPTIONS" || inst.segment === "MCX_COMMODITY"
          ? Math.floor(450000 + (inst.basePrice * 91) % 1900000)
          : undefined,
      history,
      updatedAt: now,
    };
  }
  return quotes;
}

export function stepMarketQuotes(
  prevQuotes: Record<string, LiveQuote>,
  regime: MarketRegime
): Record<string, LiveQuote> {
  const meta = REGIME_META[regime];
  const nextQuotes: Record<string, LiveQuote> = {};
  const now = new Date().toISOString();

  for (const inst of PAPER_INSTRUMENTS) {
    const prev = prevQuotes[inst.id];
    if (!prev) continue;

    // Box-Muller approximate Gaussian shock
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const sigma = inst.volatility * meta.volMultiplier;
    const meanReversion = ((inst.basePrice - prev.last) / inst.basePrice) * 0.015;
    let pctMove = meta.drift + meanReversion + z * sigma;

    // Options reflect mild theta decay + amplified volatility
    if (inst.segment === "NSE_OPTIONS" && inst.greeks) {
      const thetaImpact = (inst.greeks.theta / Math.max(prev.last, 10)) * 0.004;
      pctMove += thetaImpact;
    }

    const rawNext = prev.last * (1 + pctMove);
    const last = roundToTick(Math.max(inst.tickSize * 5, rawNext), inst.tickSize);
    const spreadMultiplier = regime === "VOLATILITY_SPIKE" ? 1.8 : 1.0;
    const halfSpread = last * ((inst.spreadBps * spreadMultiplier) / 20000);
    const bid = roundToTick(last - halfSpread, inst.tickSize);
    const ask = roundToTick(last + halfSpread, inst.tickSize);
    const high = Math.max(prev.high, last);
    const low = Math.min(prev.low, last);
    const change = Number((last - prev.prevClose).toFixed(4));
    const changePercent = Number(((change / prev.prevClose) * 100).toFixed(2));
    const history = [...prev.history.slice(-47), last];

    nextQuotes[inst.id] = {
      ...prev,
      last,
      bid,
      ask,
      high,
      low,
      change,
      changePercent,
      volume: prev.volume + Math.floor(Math.random() * 4200 + 250),
      openInterest: prev.openInterest
        ? Math.max(1000, prev.openInterest + Math.floor((Math.random() - 0.48) * 1800))
        : undefined,
      history,
      updatedAt: now,
    };
  }
  return nextQuotes;
}

export function getInstrumentById(id: string): PaperInstrument {
  return PAPER_INSTRUMENTS.find((item) => item.id === id) ?? PAPER_INSTRUMENTS[0];
}

const QUOTES_SESSION_KEY = "tradeguru_quotes_snapshot_v1";
const QUOTES_TTL_MS = 5 * 60 * 1000;

export function getCanonicalAtmStrike(
  underlying: "NIFTY" | "BANKNIFTY",
  quotes: Record<string, LiveQuote>
): number {
  const futId = underlying === "NIFTY" ? "NFO:NIFTY-FUT" : "NFO:BANKNIFTY-FUT";
  const futQuote = quotes[futId];
  const baseSpot = underlying === "NIFTY" ? 24500 : 52100;
  const basis = underlying === "NIFTY" ? 55 : 120;
  const step = underlying === "NIFTY" ? 50 : 100;
  const spot = futQuote ? futQuote.last - basis : baseSpot;
  return Math.round(spot / step) * step;
}

export function getDynamicInstrumentDisplay(
  inst: PaperInstrument,
  quotes: Record<string, LiveQuote>
): { symbol: string; name: string; strike?: number } {
  if (inst.id === "NFO:NIFTY-24500-CE" || inst.id === "NFO:NIFTY-24500-PE") {
    const atm = getCanonicalAtmStrike("NIFTY", quotes);
    const opt = inst.id.endsWith("-CE") ? "CE" : "PE";
    return {
      symbol: `NIFTY ${atm} ${opt}`,
      name: `Nifty 50 ${atm} ${opt === "CE" ? "Call" : "Put"} Option (ATM)`,
      strike: atm,
    };
  }
  if (inst.id === "NFO:BANKNIFTY-52000-CE" || inst.id === "NFO:BANKNIFTY-52000-PE") {
    const atm = getCanonicalAtmStrike("BANKNIFTY", quotes);
    const opt = inst.id.endsWith("-CE") ? "CE" : "PE";
    return {
      symbol: `BANKNIFTY ${atm} ${opt}`,
      name: `Bank Nifty ${atm} ${opt === "CE" ? "Call" : "Put"} Option (ATM)`,
      strike: atm,
    };
  }
  return { symbol: inst.symbol, name: inst.name, strike: inst.greeks?.strikePrice };
}

export function loadSessionQuotes(): Record<string, LiveQuote> {
  const fresh = createInitialQuotes();
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.sessionStorage.getItem(QUOTES_SESSION_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as { savedAt?: number; quotes?: Record<string, LiveQuote> };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > QUOTES_TTL_MS || !parsed.quotes) {
      return fresh;
    }
    const merged: Record<string, LiveQuote> = { ...fresh };
    for (const [id, q] of Object.entries(parsed.quotes)) {
      if (merged[id] && Number.isFinite(q.last) && q.last > 0) {
        merged[id] = { ...merged[id], ...q };
      }
    }
    return merged;
  } catch {
    return fresh;
  }
}

export function saveSessionQuotes(quotes: Record<string, LiveQuote>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      QUOTES_SESSION_KEY,
      JSON.stringify({ savedAt: Date.now(), quotes })
    );
  } catch {
    /* ignore storage quota errors */
  }
}
