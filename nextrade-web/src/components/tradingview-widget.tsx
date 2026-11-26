"use client";

import { useEffect, useRef, useState } from "react";

type WidgetKind = "market-overview" | "advanced-chart" | "ticker-tape" | "timeline";

const scriptByKind: Record<WidgetKind, string> = {
  "market-overview": "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
  "advanced-chart": "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "ticker-tape": "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js",
  timeline: "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js",
};

const indianEquities = [
  { s: "BSE:SENSEX", d: "SENSEX" },
  { s: "BSE:RELIANCE", d: "Reliance" },
  { s: "BSE:TCS", d: "TCS" },
  { s: "BSE:HDFCBANK", d: "HDFC Bank" },
  { s: "BSE:INFY", d: "Infosys" },
];

const indianIndices = [
  { s: "BSE:SENSEX", d: "BSE SENSEX" },
  { s: "BSE:BANK", d: "BSE Bankex" },
  { s: "BSE:IT", d: "BSE IT" },
  { s: "BSE:AUTO", d: "BSE Auto" },
];

const globalBenchmarks = [
  { s: "FOREXCOM:SPXUSD", d: "S&P 500 (USD)" },
  { s: "NASDAQ:NDX", d: "Nasdaq 100 (USD)" },
  { s: "NASDAQ:AAPL", d: "Apple (USD)" },
  { s: "NASDAQ:MSFT", d: "Microsoft (USD)" },
];

function configFor(kind: WidgetKind, symbol?: string, interval?: string) {
  if (kind === "ticker-tape") {
    return {
      symbols: indianEquities.map(({ s, d }) => ({ proName: s, title: d })),
      showSymbolLogo: true,
      colorTheme: "light",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "en",
    };
  }
  if (kind === "market-overview") {
    return {
      colorTheme: "light",
      dateRange: "1D",
      showChart: true,
      locale: "en",
      isTransparent: false,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: "100%",
      height: "100%",
      tabs: [
        { title: "Indian Equities (INR)", symbols: indianEquities.slice(1, 4) },
        { title: "Indian Indices", symbols: indianIndices },
        { title: "Global Benchmarks (USD)", symbols: globalBenchmarks },
      ],
    };
  }
  if (kind === "timeline") {
    return {
      feedMode: "all_symbols",
      isTransparent: false,
      displayMode: "regular",
      width: "100%",
      height: "100%",
      colorTheme: "light",
      locale: "en",
    };
  }
  return {
    autosize: true,
    symbol: symbol ?? "BSE:RELIANCE",
    interval: interval ?? "D",
    timezone: "Asia/Kolkata",
    theme: "light",
    style: "1",
    locale: "en",
    allow_symbol_change: true,
    hide_side_toolbar: true,
    hide_top_toolbar: false,
    save_image: false,
    calendar: false,
    support_host: "https://www.tradingview.com",
  };
}

export function TradingViewWidget({
  kind,
  symbol,
  interval,
  title,
  note,
}: {
  kind: WidgetKind;
  symbol?: string;
  interval?: string;
  title: string;
  note?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const target = root.current;
    if (!target) return;
    setLoadError(false);
    setLoading(true);
    target.replaceChildren();

    const container = document.createElement("div");
    container.className = "tradingview-widget-container__widget";
    container.style.width = "100%";
    container.style.height = "100%";

    const script = document.createElement("script");
    script.src = scriptByKind[kind];
    script.async = true;
    script.textContent = JSON.stringify(configFor(kind, symbol, interval));
    script.onerror = () => {
      setLoadError(true);
      setLoading(false);
    };

    const observer = new MutationObserver(() => {
      const iframe = target.querySelector("iframe");
      if (iframe) {
        iframe.addEventListener("load", () => setLoading(false), { once: true });
        observer.disconnect();
      }
    });
    observer.observe(target, { childList: true, subtree: true });

    const fallbackTimer = window.setTimeout(() => setLoading(false), 3200);

    target.append(container, script);
    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
      script.onerror = null;
      target.replaceChildren();
    };
  }, [kind, symbol, interval]);

  return (
    <section className={`tv-panel tv-${kind}`} aria-label={title}>
      {loading && !loadError && (
        <div className="tv-skeleton" role="status" aria-live="polite">
          <span>Loading {title}…</span>
        </div>
      )}
      <div ref={root} className="tradingview-widget-container" />
      {loadError && (
        <p className="tv-load-error" role="status">
          TradingView could not load this market widget. Check your connection or browser content blocker, then reload.
        </p>
      )}
      <div className="tv-footer-row">
        {note && <span className="tv-delay-note">{note}</span>}
        <a className="tv-credit" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          Data and charts by TradingView ↗
        </a>
      </div>
    </section>
  );
}
