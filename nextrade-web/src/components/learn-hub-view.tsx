"use client";

import { useState } from "react";

const GUIDE_URL = "https://flattrade.in/learn/glossary/paper-trading/";

const SEVEN_STEPS = [
  { title: "1. Choose a Platform", body: "Pick a simulator with live or near-live NSE, BSE, or MCX data supporting your instruments and order types." },
  { title: "2. Set Realistic Virtual Capital", body: "Match your virtual balance (e.g. ₹1L–₹10L) to the capital you will actually deploy live so position sizing transfers cleanly." },
  { title: "3. Analyse and Plan Trades", body: "Review charts, indicators, entry, stop-loss, and target before clicking buy or sell, and document your rationale." },
  { title: "4. Place and Manage Simulated Orders", body: "Use real order types (Market, Limit, SL, SL-M, Bracket, Cover, GTC) and stick to your exit plan." },
  { title: "5. Track Results Rigorously", body: "Log entry/exit prices, quantity, planned vs. actual execution, and estimated Indian transaction costs." },
  { title: "6. Review and Refine", body: "Audit your journal weekly or fortnightly to measure win rate, risk-reward, equity curve, and emotional lapses." },
  { title: "7. Establish Go-Live Benchmarks", body: "Complete at least 50–100 trades with positive expectancy across multiple market conditions before going live." },
];

const FAQS = [
  {
    q: "What is paper trading in simple terms?",
    a: "Paper trading is simulating buy and sell trades using virtual money at real market prices. You practice analysis, order placement, and risk management with zero financial risk.",
  },
  {
    q: "What is the difference between paper trading and backtesting?",
    a: "Backtesting applies rules to historical data after the fact. Paper trading runs in real time as the market moves, introducing realistic decision-making under uncertainty.",
  },
  {
    q: "How long should I paper trade before going live?",
    a: "Focus on trade count rather than calendar days—complete at least 50 to 100 trades across bull, sideways, and volatile market conditions to confirm a real statistical edge.",
  },
  {
    q: "Can I paper trade NSE/BSE equities, F&O, MCX commodities, and currency?",
    a: "Yes. NexTrade simulates all of these Indian segments—cash equities, Nifty/Bank Nifty futures & options (with Greeks and lot sizes), MCX Gold/Crude, and USD-INR futures.",
  },
  {
    q: "Are there any tax implications for paper trading in India?",
    a: "No tax applies during paper trading because no real money changes hands. Once live, equity delivery is taxed as capital gains, intraday equity as speculative business income, and F&O as non-speculative business income.",
  },
  {
    q: "Why do some paper traders struggle when switching to live money?",
    a: "Fear and greed behave differently when real capital is at risk, and live markets introduce slippage and partial fills. Start live with only 10–20% of planned capital and keep journaling.",
  },
  {
    q: "Should I use the same position sizes as my planned live account?",
    a: "Yes. If you plan to trade ₹2 lakh live, practice with ₹2 lakh virtual capital—not ₹10 lakh—so your rupee risk per trade (1–2%) stays realistic.",
  },
  {
    q: "How do I measure if my paper trading is improving?",
    a: "Track Expectancy per Trade = (Win Rate × Avg Win) − (Loss Rate × Avg Loss), net of Indian transaction costs, along with Maximum Drawdown and consistency across market regimes.",
  },
  {
    q: "How is paper trading regulated in India?",
    a: "Standalone paper trading simulators are not separately regulated by SEBI because no real financial transactions occur, though SEBI-registered brokers operating simulators remain under SEBI oversight.",
  },
];

const RELATED_TERMS = [
  { term: "Intraday Trading", desc: "Buying and selling instruments within the same trading session so all positions are squared off before market close." },
  { term: "Swing Trading", desc: "Holding positions for two days to several weeks to capture a medium-term directional move." },
  { term: "Risk Management", desc: "Controlling financial exposure on every trade through position sizing (1–2% risk) and drawdown limits." },
  { term: "Technical Analysis", desc: "Studying historical price and volume data (candlesticks, VWAP, RSI, MACD, moving averages) to forecast setups." },
  { term: "Stop-Loss Orders", desc: "Instructions that automatically exit a position if price reaches a specified adverse level, capping losses." },
  { term: "Candlestick Patterns", desc: "Visual price-action formations (e.g., Morning Star, breakouts) used to spot potential reversals or continuations." },
];

export function LearnHubView({ onOpenTerminal, onOpenCalculators }: { onOpenTerminal: () => void; onOpenCalculators: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="nt-stack">
      {/* Intro & History */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">PAPER TRADING ACADEMY · ADAPTED FROM FLATTRADE LEARN</span>
            <h2>Everything You Need to Know Before Risking Real Capital</h2>
          </div>
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="nt-pill">
            Read Original Guide ↗
          </a>
        </div>
        <p className="nt-prose">
          The stock market is the most expensive classroom if you enter unprepared. Paper trading (virtual or simulated trading) lets you practise analysis, order entry, stop-loss placement, and position sizing at live market prices with zero financial risk. Historically, aspiring traders logged imaginary trades in paper notebooks during BSE&apos;s open-outcry era (founded 1875); after NSE launched electronic order matching in 1994 and mobile platforms grew in the 2010s, digital simulators added order books, bid-ask spreads, and slippage modeling.
        </p>
        <div className="nt-inline-actions" style={{ marginTop: 12 }}>
          <button type="button" className="primary-button" onClick={onOpenTerminal}>
            Practice in Trade Terminal →
          </button>
          <button type="button" className="nt-pill" onClick={onOpenCalculators}>
            Open Position Size &amp; Tax Calculators
          </button>
        </div>
      </section>

      {/* 7-Step Framework */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">STRUCTURED WORKFLOW</span>
            <h2>7 Steps to Paper Trade Seriously</h2>
          </div>
        </div>
        <div className="nt-steps-grid">
          {SEVEN_STEPS.map((step) => (
            <div key={step.title} className="nt-step-card">
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits vs Limitations + Derivatives */}
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">WHAT YOU ACTUALLY LEARN</span>
              <h2>Core Benefits &amp; Honest Limits</h2>
            </div>
          </div>
          <ul className="nt-bullet-list">
            <li><strong>Zero Financial Risk:</strong> Make order-entry and strategy mistakes without losing real savings.</li>
            <li><strong>Market Mechanics:</strong> Experience market vs. limit fills, short selling, slippage, and stop-loss triggers firsthand.</li>
            <li><strong>Analytical &amp; Journaling Habits:</strong> Documenting entry rationale builds repeatable discipline.</li>
            <li><strong>Position Sizing &amp; Leverage:</strong> Repeatedly calculate 1–2% rupee risk and see how futures margin amplifies 1% moves.</li>
            <li><strong>Key Limitation:</strong> Virtual money cannot fully simulate live fear/greed or illiquid order fills—always start live with just 10–20% of planned capital.</li>
          </ul>
        </section>

        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">DERIVATIVES &amp; PLATFORM CHECKLIST</span>
              <h2>F&amp;O, MCX &amp; Choosing a Simulator</h2>
            </div>
          </div>
          <ul className="nt-bullet-list">
            <li><strong>Equity Futures:</strong> Learn standardized NSE lot sizes, daily Mark-to-Market (MTM), open interest, roll-over, and futures-spot basis.</li>
            <li><strong>Options Greeks:</strong> Watch Delta, Gamma, Theta (accelerating final-week decay), and Implied Volatility spikes around RBI/Budget events.</li>
            <li><strong>MCX &amp; Currency:</strong> Understand contract units (Gold grams, Crude barrels, 1,000 USD lots), tick sizes, and delivery vs. cash settlement.</li>
            <li><strong>Platform Checklist:</strong> Live (not 15-min delayed) feeds, full order types (Limit, SL, Bracket, Cover, GTC), equity curve analytics, and broker UI parity.</li>
          </ul>
        </section>
      </div>

      {/* Interactive FAQ Accordion */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">FREQUENTLY ASKED QUESTIONS</span>
            <h2>Paper Trading FAQs (Indian Market Context)</h2>
          </div>
        </div>
        <div className="nt-faq-list">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="nt-faq-item">
                <button
                  type="button"
                  className="nt-faq-q"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span>{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && <p className="nt-faq-a">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* GeeksforGeeks Paper Trading vs Real Trading 8-Dimension Comparison */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">PAPER VS. REAL TRADING · ADAPTED FROM GEEKSFORGEEKS</span>
            <h2>8 Key Differences Every Beginner Must Know</h2>
          </div>
          <a href="https://www.geeksforgeeks.org/finance/what-is-paper-trading-and-how-it-works/" target="_blank" rel="noreferrer" className="nt-pill">
            Read GeeksforGeeks Guide ↗
          </a>
        </div>
        <div className="api-market-table-wrap">
          <table className="api-market-table">
            <thead>
              <tr>
                <th>Basis</th>
                <th>Paper Trading (Virtual)</th>
                <th>Real Trading (Live Capital)</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row"><strong>Financial Risk</strong></th><td>Zero risk of financial loss; virtual currency only.</td><td>Real money at stake with real financial consequences.</td></tr>
              <tr><th scope="row"><strong>Emotional Impact</strong></th><td>Low emotional pressure; no genuine fear or greed.</td><td>Anxiety, greed, and tension heavily influence decisions.</td></tr>
              <tr><th scope="row"><strong>Learning Mode</strong></th><td>Safe strategy testing and platform practice.</td><td>Practical experience with real-world market repercussions.</td></tr>
              <tr><th scope="row"><strong>Market Realism</strong></th><td>Simulated environment may not mirror extreme conditions.</td><td>Price shifts, spreads, and liquidity react in real time.</td></tr>
              <tr><th scope="row"><strong>Order Execution</strong></th><td>Orders typically execute quickly without delay.</td><td>Volatility can cause delays, partial fills, and slippage.</td></tr>
              <tr><th scope="row"><strong>Broker &amp; Regulation</strong></th><td>No real broker or exchange settlement obligations.</td><td>Live SEBI-registered broker, exchange, and tax filings.</td></tr>
              <tr><th scope="row"><strong>Market Liquidity</strong></th><td>Simulated fills may appear cleaner than thin live books.</td><td>Liquidity directly impacts execution price and slippage.</td></tr>
              <tr><th scope="row"><strong>Performance Tracking</strong></th><td>Tracked inside virtual portfolio &amp; Teacher Report Card.</td><td>Real-time P&amp;L with real tax and capital impact.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Related Terms */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">GLOSSARY</span>
            <h2>Related Trading Terms</h2>
          </div>
        </div>
        <div className="nt-steps-grid">
          {RELATED_TERMS.map((item) => (
            <div key={item.term} className="nt-step-card">
              <strong>{item.term}</strong>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
