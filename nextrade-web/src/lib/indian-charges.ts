/**
 * @module lib/indian-charges
 * @description Statutory Indian market transaction cost, breakeven, position-sizing, and tax-classification engine.
 *
 * Domain Rules Implemented:
 * - Supports both ₹0 Zero Brokerage and ₹20/order Discount Broker plans across NSE/BSE Equity (MIS/CNC),
 *   NSE F&O (Futures/Options), MCX Commodities (CTT), and NSE Currency segments.
 * - Computes STT/CTT, Exchange transaction charges, SEBI turnover fees, Maharashtra-standard Stamp Duty
 *   (buy side), and 18% GST on (Brokerage + Exchange + SEBI).
 * - `calculatePositionSize`: Enforces risk-per-trade capital sizing (e.g., 1% rule) net of charges.
 */

import type { MarketSegment } from "./paper-instruments";

export type ProductType = "INTRADAY" | "DELIVERY" | "NRML";
export type BrokeragePlan = "ZERO_BROKERAGE" | "FLAT_20";

export type IndianChargesBreakdown = {
  turnover: number;
  brokerage: number;
  sttOrCtt: number;
  sttLabel: "STT" | "CTT";
  exchangeCharges: number;
  sebiFees: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  breakevenPointsPerUnit: number;
};

/**
 * Estimates realistic Indian market transaction costs per Flattrade Learn guide:
 * Brokerage + STT/CTT + Exchange Charges + GST (18%) + SEBI Fee + Stamp Duty.
 */
export function calculateIndianCharges(params: {
  segment: MarketSegment;
  product: ProductType;
  side: "BUY" | "SELL";
  price: number;
  quantity: number; // total shares or total units (lots * lotSize)
  brokeragePlan: BrokeragePlan;
}): IndianChargesBreakdown {
  const { segment, product, side, price, quantity, brokeragePlan } = params;
  const turnover = Math.max(0, price * quantity);

  // Brokerage: ₹0 (Zero Brokerage like Flattrade) or min(₹20, 0.03% of turnover)
  let brokerage = 0;
  if (brokeragePlan === "FLAT_20" && turnover > 0) {
    if (segment === "NSE_OPTIONS" || (segment === "NSE_EQUITY" && product === "DELIVERY")) {
      brokerage = segment === "NSE_OPTIONS" ? 20 : 0;
    } else {
      brokerage = Math.min(20, turnover * 0.0003);
    }
  }

  // STT / CTT rates (indicative Indian market schedule)
  let sttOrCtt = 0;
  const sttLabel: "STT" | "CTT" = segment === "MCX_COMMODITY" ? "CTT" : "STT";

  if (segment === "NSE_EQUITY" || segment === "BSE_EQUITY" || segment === "ETF_GSEC") {
    if (product === "DELIVERY") {
      sttOrCtt = turnover * 0.001; // 0.1% on both buy & sell
    } else {
      sttOrCtt = side === "SELL" ? turnover * 0.00025 : 0; // 0.025% on sell side intraday
    }
  } else if (segment === "NSE_FUTURES") {
    sttOrCtt = side === "SELL" ? turnover * 0.0002 : 0;
  } else if (segment === "NSE_OPTIONS") {
    sttOrCtt = side === "SELL" ? turnover * 0.001 : 0;
  } else if (segment === "MCX_COMMODITY") {
    sttOrCtt = side === "SELL" ? turnover * 0.0001 : 0; // CTT on non-agri futures sell
  } else if (segment === "NSE_CURRENCY") {
    sttOrCtt = 0;
  }

  // Exchange transaction charges (indicative)
  let exRate = 0.0000297; // NSE equity ~0.00297%
  if (segment === "BSE_EQUITY") exRate = 0.0000375;
  else if (segment === "NSE_FUTURES") exRate = 0.0000173;
  else if (segment === "NSE_OPTIONS") exRate = 0.0003503;
  else if (segment === "MCX_COMMODITY") exRate = 0.000021;
  else if (segment === "NSE_CURRENCY") exRate = 0.0000035;
  const exchangeCharges = turnover * exRate;

  // SEBI turnover fee: ₹10 per crore (0.0001%)
  const sebiFees = turnover * 0.000001;

  // Stamp duty (buy side only)
  let stampRate = 0;
  if (side === "BUY") {
    if ((segment === "NSE_EQUITY" || segment === "BSE_EQUITY" || segment === "ETF_GSEC") && product === "DELIVERY") {
      stampRate = 0.00015; // 0.015%
    } else if (segment === "NSE_EQUITY" || segment === "BSE_EQUITY" || segment === "ETF_GSEC") {
      stampRate = 0.00003; // 0.003% intraday
    } else if (segment === "NSE_FUTURES" || segment === "MCX_COMMODITY") {
      stampRate = 0.00002; // 0.002%
    } else if (segment === "NSE_OPTIONS") {
      stampRate = 0.00003; // 0.003%
    } else if (segment === "NSE_CURRENCY") {
      stampRate = 0.000001; // 0.0001%
    }
  }
  const stampDuty = turnover * stampRate;

  // 18% GST on Brokerage + Exchange + SEBI
  const gst = (brokerage + exchangeCharges + sebiFees) * 0.18;

  const totalCharges = brokerage + sttOrCtt + exchangeCharges + sebiFees + stampDuty + gst;
  const breakevenPointsPerUnit = quantity > 0 ? totalCharges / quantity : 0;

  return {
    turnover: round2(turnover),
    brokerage: round2(brokerage),
    sttOrCtt: round2(sttOrCtt),
    sttLabel,
    exchangeCharges: round2(exchangeCharges),
    sebiFees: round2(sebiFees),
    stampDuty: round2(stampDuty),
    gst: round2(gst),
    totalCharges: round2(totalCharges),
    breakevenPointsPerUnit: Number(breakevenPointsPerUnit.toFixed(4)),
  };
}

export function calculateRoundTripCharges(params: {
  segment: MarketSegment;
  product: ProductType;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  brokeragePlan: BrokeragePlan;
}): IndianChargesBreakdown {
  const buy = calculateIndianCharges({
    segment: params.segment,
    product: params.product,
    side: "BUY",
    price: params.buyPrice,
    quantity: params.quantity,
    brokeragePlan: params.brokeragePlan,
  });
  const sell = calculateIndianCharges({
    segment: params.segment,
    product: params.product,
    side: "SELL",
    price: params.sellPrice,
    quantity: params.quantity,
    brokeragePlan: params.brokeragePlan,
  });
  const totalCharges = round2(buy.totalCharges + sell.totalCharges);
  return {
    turnover: round2(buy.turnover + sell.turnover),
    brokerage: round2(buy.brokerage + sell.brokerage),
    sttOrCtt: round2(buy.sttOrCtt + sell.sttOrCtt),
    sttLabel: buy.sttLabel,
    exchangeCharges: round2(buy.exchangeCharges + sell.exchangeCharges),
    sebiFees: round2(buy.sebiFees + sell.sebiFees),
    stampDuty: round2(buy.stampDuty + sell.stampDuty),
    gst: round2(buy.gst + sell.gst),
    totalCharges,
    breakevenPointsPerUnit: params.quantity > 0 ? Number((totalCharges / params.quantity).toFixed(4)) : 0,
  };
}

export type PositionSizeResult = {
  riskAmount: number;
  stopDistance: number;
  rewardDistance: number;
  riskRewardRatio: number;
  recommendedUnits: number;
  recommendedLots: number;
  notionalExposure: number;
  exposurePercent: number;
  estimatedRoundTripCost: number;
  projectedGrossProfit: number;
  projectedNetProfit: number;
};

export function calculatePositionSize(params: {
  capital: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  lotSize: number;
  segment: MarketSegment;
  product: ProductType;
  brokeragePlan: BrokeragePlan;
}): PositionSizeResult {
  const { capital, riskPercent, entryPrice, stopLossPrice, targetPrice, lotSize, segment, product, brokeragePlan } = params;
  const riskAmount = Math.max(0, (capital * riskPercent) / 100);
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  const rewardDistance = Math.abs(targetPrice - entryPrice);
  const riskRewardRatio = stopDistance > 0 ? Number((rewardDistance / stopDistance).toFixed(2)) : 0;

  const rawUnits = stopDistance > 0 ? Math.floor(riskAmount / stopDistance) : 0;
  const recommendedLots = lotSize > 1 ? Math.floor(rawUnits / lotSize) : rawUnits;
  const recommendedUnits = recommendedLots * lotSize;
  const notionalExposure = round2(recommendedUnits * entryPrice);
  const exposurePercent = capital > 0 ? Number(((notionalExposure / capital) * 100).toFixed(1)) : 0;

  const costs = calculateRoundTripCharges({
    segment,
    product,
    buyPrice: Math.min(entryPrice, targetPrice),
    sellPrice: Math.max(entryPrice, targetPrice),
    quantity: recommendedUnits,
    brokeragePlan,
  });

  const projectedGrossProfit = round2(recommendedUnits * rewardDistance);
  const projectedNetProfit = round2(projectedGrossProfit - costs.totalCharges);

  return {
    riskAmount: round2(riskAmount),
    stopDistance: round2(stopDistance),
    rewardDistance: round2(rewardDistance),
    riskRewardRatio,
    recommendedUnits,
    recommendedLots,
    notionalExposure,
    exposurePercent,
    estimatedRoundTripCost: costs.totalCharges,
    projectedGrossProfit,
    projectedNetProfit,
  };
}

export function getIndianTaxClassification(segment: MarketSegment, product: ProductType): {
  category: string;
  lossSetOff: string;
  note: string;
} {
  if ((segment === "NSE_EQUITY" || segment === "BSE_EQUITY" || segment === "ETF_GSEC") && product === "DELIVERY") {
    return {
      category: "Capital Gains (STCG / LTCG)",
      lossSetOff: "Short-term capital losses offset STCG & LTCG; long-term losses offset LTCG only.",
      note: "Holding period determines short-term vs. long-term rates under the latest Finance Act. Paper trades incur ₹0 tax.",
    };
  }
  if ((segment === "NSE_EQUITY" || segment === "BSE_EQUITY") && product === "INTRADAY") {
    return {
      category: "Speculative Business Income",
      lossSetOff: "Speculative losses can only be set off against speculative gains.",
      note: "Same-day equity square-offs without demat delivery are treated as speculative business income in India.",
    };
  }
  return {
    category: "Non-Speculative Business Income",
    lossSetOff: "Broader set-off provisions against other business income (excluding salary).",
    note: "Equity F&O, MCX commodities, and currency derivatives fall under non-speculative business income. Consult a CA for live filing.",
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
