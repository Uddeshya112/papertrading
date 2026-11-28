"use client";

import { useMemo, useState } from "react";
import { ACADEMY_COURSES } from "@/lib/academy-courses";
import type { PaperAccountState } from "@/lib/paper-engine";
import { PAPER_INSTRUMENTS, type LiveQuote } from "@/lib/paper-instruments";
import { plural } from "@/lib/format";
import { TradingViewWidget } from "./tradingview-widget";
import { getSupabase } from "@/lib/supabase";

type Props = {
  account: PaperAccountState;
  quotes: Record<string, LiveQuote>;
  onTradeInstrument: (id: string) => void;
  onAdminUpdateConfig: (patch: { defaultVirtualCapital?: number; autoRefillThreshold?: number; announcement?: string }) => void;
};

const EDUCATIONAL_EVENTS = [
  { date: "Bi-Monthly", type: "Monetary Policy", title: "RBI Monetary Policy Committee (MPC) Rate Decision", note: "High volatility event for BANK NIFTY & USDINR." },
  { date: "Feb 1 (Annual)", type: "Fiscal Policy", title: "Union Budget of India", note: "Major intraday volatility spike across indices and sectors." },
  { date: "Quarterly (Apr/Jul/Oct/Jan)", type: "Earnings Season", title: "NSE Large-Cap Quarterly Results (IT, Banking, FMCG)", note: "Watch overnight gap risk on swing positions." },
  { date: "Monthly Last Thu", type: "Derivatives", title: "NSE Monthly F&O Expiry", note: "Accelerating Theta decay and roll-over volume." },
];

export function MarketIntelAdminView({
  account,
  quotes,
  onTradeInstrument,
  onAdminUpdateConfig,
}: Props) {
  const [subTab, setSubTab] = useState<"INTEL" | "ADMIN">("INTEL");
  const [adminCap, setAdminCap] = useState(account.adminConfig.defaultVirtualCapital);
  const [adminThresh, setAdminThresh] = useState(account.adminConfig.autoRefillThreshold);
  const [announcementText, setAnnouncementText] = useState("");
  const [serverAuditStatus, setServerAuditStatus] = useState<string>("Not queried");
  const [serverAuditLogs, setServerAuditLogs] = useState<Array<{ id: string; actor: string; action: string; resource_type: string; created_at: string }>>([]);

  const breadth = useMemo(() => {
    let adv = 0;
    let dec = 0;
    for (const inst of PAPER_INSTRUMENTS) {
      const chg = quotes[inst.id]?.change ?? 0;
      if (chg >= 0) adv++;
      else dec++;
    }
    return { adv, dec, total: PAPER_INSTRUMENTS.length };
  }, [quotes]);

  async function fetchServerAuditLogs() {
    setServerAuditStatus("Loading server audit logs…");
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setServerAuditStatus("Sign in with an authorized Admin + MFA (AAL2) account to query /api/admin/audit.");
        return;
      }
      const res = await fetch("/api/admin/audit", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; logs?: Array<{ id: string; actor: string; action: string; resource_type: string; created_at: string }> };
      if (!res.ok || !json.ok) {
        setServerAuditStatus(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setServerAuditLogs(json.logs ?? []);
      setServerAuditStatus(`Verified via /api/admin/audit (${json.logs?.length ?? 0} server records).`);
    } catch {
      setServerAuditStatus("Cloud audit session unavailable in local guest mode.");
    }
  }

  const nifty = quotes["NFO:NIFTY-FUT"];
  const bankNifty = quotes["NFO:BANKNIFTY-FUT"];
  const sensexEst = nifty ? Number((nifty.last * 3.285).toFixed(2)) : 80650;

  return (
    <div className="nt-stack">
      <div className="nt-inline-actions">
        <button type="button" className={`nt-pill${subTab === "INTEL" ? " active" : ""}`} onClick={() => setSubTab("INTEL")}>
          Market Intelligence Center
        </button>
        <button type="button" className={`nt-pill${subTab === "ADMIN" ? " active" : ""}`} onClick={() => setSubTab("ADMIN")}>
          Admin &amp; Immutable Audit Console
        </button>
      </div>

      {subTab === "INTEL" && (
        <div className="nt-stack">
          {/* Indices & Breadth */}
          <div className="nt-kpi-grid">
            <div className="surface-card nt-kpi">
              <span className="card-kicker">NIFTY 50 (SIMULATED REF)</span>
              <strong>{nifty ? nifty.last.toLocaleString("en-IN") : "24,560"}</strong>
              <small className={(nifty?.changePercent ?? 0) >= 0 ? "nt-pos" : "nt-neg"}>
                {nifty ? `${nifty.changePercent >= 0 ? "+" : ""}${nifty.changePercent}%` : "—"}
              </small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">BANK NIFTY (SIMULATED REF)</span>
              <strong>{bankNifty ? bankNifty.last.toLocaleString("en-IN") : "52,180"}</strong>
              <small className={(bankNifty?.changePercent ?? 0) >= 0 ? "nt-pos" : "nt-neg"}>
                {bankNifty ? `${bankNifty.changePercent >= 0 ? "+" : ""}${bankNifty.changePercent}%` : "—"}
              </small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">SENSEX (SIMULATED REF)</span>
              <strong>{sensexEst.toLocaleString("en-IN")}</strong>
              <small>BSE 30 benchmark reference</small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">MARKET BREADTH</span>
              <strong>{breadth.adv} Adv / {breadth.dec} Dec</strong>
              <small>{breadth.adv >= breadth.dec ? "Constructive breadth" : "Defensive breadth"}</small>
            </div>
          </div>

          {/* Recurring Indian Market Calendar (Clearly Labeled Educational Reference) */}
          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">EDUCATIONAL REFERENCE · RECURRING INDIAN MACRO &amp; CORPORATE EVENTS</span>
                <h2>Economic, Earnings &amp; Expiry Calendar</h2>
              </div>
              <span className="source-tag">No fabricated headlines</span>
            </div>
            <div className="api-market-table-wrap">
              <table className="api-market-table">
                <thead>
                  <tr><th>Cadence</th><th>Category</th><th>Event</th><th>Trading Impact Note</th></tr>
                </thead>
                <tbody>
                  {EDUCATIONAL_EVENTS.map((ev) => (
                    <tr key={ev.title}>
                      <td><strong>{ev.date}</strong></td>
                      <td><span className="source-tag">{ev.type}</span></td>
                      <td><strong>{ev.title}</strong></td>
                      <td>{ev.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Attributed Live Third-Party News & Market Overview */}
          <div className="dashboard-grid">
            <section className="surface-card news-card">
              <div className="card-heading">
                <div>
                  <span className="card-kicker">ATTRIBUTED THIRD-PARTY FEED</span>
                  <h2>Live Market News</h2>
                </div>
                <a href="https://www.tradingview.com/news/" target="_blank" rel="noreferrer">TradingView ↗</a>
              </div>
              <TradingViewWidget kind="timeline" title="Market news timeline" />
            </section>

            <section className="surface-card">
              <div className="card-heading">
                <div>
                  <span className="card-kicker">QUICK INSTRUMENT ACCESS</span>
                  <h2>Active Volume Leaders</h2>
                </div>
              </div>
              <div className="nt-watch-list" style={{ maxHeight: 270 }}>
                {[...PAPER_INSTRUMENTS]
                  .sort((a, b) => (quotes[b.id]?.volume ?? 0) - (quotes[a.id]?.volume ?? 0))
                  .slice(0, 6)
                  .map((inst) => (
                    <button key={inst.id} type="button" className="nt-watch-row" onClick={() => onTradeInstrument(inst.id)}>
                      <div className="nt-watch-sym">
                        <strong>{inst.symbol}</strong>
                        <small>{inst.sector} · Vol {((quotes[inst.id]?.volume ?? 0) / 1000).toFixed(1)}k</small>
                      </div>
                      <strong>₹{(quotes[inst.id]?.last ?? inst.basePrice).toLocaleString("en-IN")}</strong>
                    </button>
                  ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {subTab === "ADMIN" && (
        <div className="nt-stack">
          <div className="nt-kpi-grid">
            <div className="surface-card nt-kpi">
              <span className="card-kicker">SYSTEM HEALTH</span>
              <strong className="nt-pos">Operational</strong>
              <small>Local Engine + TradingView Feed</small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">VIRTUAL REFILLS RECORDED</span>
              <strong>{account.resetCount}</strong>
              <small>{plural(account.journal.length, "immutable trade")} preserved</small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">ACADEMY CATALOG</span>
              <strong>{ACADEMY_COURSES.length} Courses</strong>
              <small>{account.completedCourseIds.length} completed by active user</small>
            </div>
            <div className="surface-card nt-kpi">
              <span className="card-kicker">DATA INTEGRITY LOCK</span>
              <strong className="nt-pos">Immutable</strong>
              <small>Historical trades cannot be silently edited</small>
            </div>
          </div>

          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">ROLE-BASED PLATFORM CONFIGURATION</span>
                <h2>Default Capital, Refill Policy &amp; Announcements</h2>
              </div>
            </div>
            <div className="nt-calc-form">
              <label>
                Default Virtual Capital (₹)
                <input type="number" step="50000" value={adminCap} onChange={(e) => setAdminCap(Number(e.target.value) || 1000000)} />
              </label>
              <label>
                Auto-Refill Trigger Threshold (₹)
                <input type="number" step="5000" value={adminThresh} onChange={(e) => setAdminThresh(Number(e.target.value) || 25000)} />
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                Broadcast Platform Announcement
                <input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="e.g., New Options Greeks workshop added to Academy" />
              </label>
            </div>
            <div className="nt-inline-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onAdminUpdateConfig({
                    defaultVirtualCapital: adminCap,
                    autoRefillThreshold: adminThresh,
                    announcement: announcementText.trim() || undefined,
                  });
                  setAnnouncementText("");
                }}
              >
                Save Policy &amp; Record Audit Entry
              </button>
            </div>
          </section>

          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">IMMUTABLE AUDIT LOG</span>
                <h2>Administrative &amp; Refill Audit Trail ({account.adminConfig.auditLog.length} local · {serverAuditLogs.length} server)</h2>
                <p>{serverAuditStatus}</p>
              </div>
            </div>
            <div className="nt-inline-actions" style={{ marginBottom: 10 }}>
              <button type="button" className="nt-pill active" onClick={fetchServerAuditLogs}>
                Query Live /api/admin/audit (JWT + MFA)
              </button>
            </div>
            <div className="api-market-table-wrap">
              <table className="api-market-table">
                <thead>
                  <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {account.adminConfig.auditLog.slice(0, 20).map((entry) => (
                    <tr key={entry.id}>
                      <td><time>{new Date(entry.timestamp).toLocaleString("en-IN")}</time></td>
                      <td><strong>{entry.actor}</strong></td>
                      <td><span className="source-tag">{entry.action}</span></td>
                      <td>{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
