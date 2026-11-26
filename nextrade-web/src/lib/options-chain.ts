import { roundToTick, type LiveQuote } from "./paper-instruments";

export type ChainUnderlying = "NIFTY" | "BANKNIFTY";
export type ChainExpiry = "WEEKLY" | "MONTHLY";

export type OptionSideRow = {
  contractId: string;
  symbol: string;
  ltp: number;
  changePct: number;
  iv: number;
  oi: number;
  volume: number;
  bid: number;
  bidQty: number;
  ask: number;
  askQty: number;
  delta: number;
  itm: boolean;
  movingWithUnderlying: boolean;
};

export type OptionChainStrikeRow = {
  strike: number;
  isAtm: boolean;
  call: OptionSideRow;
  put: OptionSideRow;
};

export type OptionsChainSnapshot = {
  underlying: ChainUnderlying;
  expiry: ChainExpiry;
  spotPrice: number;
  spotChangePct: number;
  lotSize: number;
  stepSize: number;
  atmStrike: number;
  rows: OptionChainStrikeRow[];
  fullPcrOi: number;
  fullPcrVolume: number;
};

export function generateOptionsChain(
  underlying: ChainUnderlying,
  expiry: ChainExpiry,
  quotes: Record<string, LiveQuote>
): OptionsChainSnapshot {
  const futId = underlying === "NIFTY" ? "NFO:NIFTY-FUT" : "NFO:BANKNIFTY-FUT";
  const futQuote = quotes[futId];
  const baseSpot = underlying === "NIFTY" ? 24500 : 52100;
  const spotPrice = futQuote ? Number((futQuote.last - (underlying === "NIFTY" ? 55 : 120)).toFixed(2)) : baseSpot;
  const spotChangePct = futQuote?.changePercent ?? 0.35;
  const stepSize = underlying === "NIFTY" ? 50 : 100;
  const lotSize = underlying === "NIFTY" ? 75 : 30;
  const atmStrike = Math.round(spotPrice / stepSize) * stepSize;
  const dteFactor = expiry === "WEEKLY" ? 1.0 : 1.75;

  const rows: OptionChainStrikeRow[] = [];
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  for (let offset = -10; offset <= 10; offset++) {
    const strike = atmStrike + offset * stepSize;
    const dist = (strike - spotPrice) / stepSize;
    const absDist = Math.abs(dist);

    // Deterministic + live-spot responsive option pricing approximation
    const timeVal = (underlying === "NIFTY" ? 135 : 310) * dteFactor * Math.exp(-0.22 * absDist);
    const callIntrinsic = Math.max(0, spotPrice - strike);
    const putIntrinsic = Math.max(0, strike - spotPrice);

    const callLtp = roundToTick(Math.max(2.5, callIntrinsic + timeVal), 0.05);
    const putLtp = roundToTick(Math.max(2.5, putIntrinsic + timeVal * 0.96), 0.05);

    const baseIv = (underlying === "NIFTY" ? 13.8 : 16.2) + absDist * 0.65 + (expiry === "MONTHLY" ? 0.9 : 0);
    const callIv = Number((baseIv + (dist > 0 ? 0.3 : 0.7)).toFixed(1));
    const putIv = Number((baseIv + (dist < 0 ? 0.9 : 0.2)).toFixed(1));

    const oiBell = Math.exp(-0.08 * absDist * absDist);
    const callOi = Math.round((140000 + (strike % 500 === 0 ? 180000 : 40000)) * oiBell * (dist >= 0 ? 1.25 : 0.72));
    const putOi = Math.round((150000 + (strike % 500 === 0 ? 195000 : 45000)) * oiBell * (dist <= 0 ? 1.3 : 0.68));

    const callVol = Math.round(callOi * (0.42 + (absDist < 3 ? 0.35 : 0.08)));
    const putVol = Math.round(putOi * (0.44 + (absDist < 3 ? 0.32 : 0.08)));

    const callChangePct = Number((spotChangePct * (dist <= 2 ? 4.2 : 2.1) - 0.35).toFixed(2));
    const putChangePct = Number((-spotChangePct * (dist >= -2 ? 4.1 : 2.0) - 0.4).toFixed(2));

    const callDelta = Number(Math.min(0.96, Math.max(0.04, 0.5 - dist * 0.08)).toFixed(2));
    const putDelta = Number((callDelta - 1).toFixed(2));

    const callSpread = Math.max(0.1, roundToTick(callLtp * 0.008, 0.05));
    const putSpread = Math.max(0.1, roundToTick(putLtp * 0.008, 0.05));

    totalCallOi += callOi;
    totalPutOi += putOi;
    totalCallVol += callVol;
    totalPutVol += putVol;

    const expTag = expiry === "WEEKLY" ? "WK" : "MO";

    rows.push({
      strike,
      isAtm: strike === atmStrike,
      call: {
        contractId: `OPT:${underlying}-${expTag}-${strike}-CE`,
        symbol: `${underlying} ${strike} CE (${expTag})`,
        ltp: callLtp,
        changePct: callChangePct,
        iv: callIv,
        oi: callOi,
        volume: callVol,
        bid: roundToTick(callLtp - callSpread, 0.05),
        bidQty: lotSize * (4 + (Math.abs(offset) % 5)),
        ask: roundToTick(callLtp + callSpread, 0.05),
        askQty: lotSize * (3 + ((Math.abs(offset) + 2) % 6)),
        delta: callDelta,
        itm: strike < spotPrice,
        movingWithUnderlying: (spotChangePct >= 0 && callChangePct > 0) || (spotChangePct < 0 && callChangePct < 0),
      },
      put: {
        contractId: `OPT:${underlying}-${expTag}-${strike}-PE`,
        symbol: `${underlying} ${strike} PE (${expTag})`,
        ltp: putLtp,
        changePct: putChangePct,
        iv: putIv,
        oi: putOi,
        volume: putVol,
        bid: roundToTick(putLtp - putSpread, 0.05),
        bidQty: lotSize * (5 + (Math.abs(offset) % 4)),
        ask: roundToTick(putLtp + putSpread, 0.05),
        askQty: lotSize * (4 + ((Math.abs(offset) + 1) % 5)),
        delta: putDelta,
        itm: strike > spotPrice,
        movingWithUnderlying: (spotChangePct <= 0 && putChangePct > 0) || (spotChangePct > 0 && putChangePct < 0),
      },
    });
  }

  return {
    underlying,
    expiry,
    spotPrice,
    spotChangePct,
    lotSize,
    stepSize,
    atmStrike,
    rows,
    fullPcrOi: totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1,
    fullPcrVolume: totalCallVol > 0 ? Number((totalPutVol / totalCallVol).toFixed(2)) : 1,
  };
}
