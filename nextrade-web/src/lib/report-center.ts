/**
 * @module lib/report-center
 * @description Downloadable trading report generator supporting 12 report types across Print/PDF HTML, CSV, and Excel (.xls).
 * Combines live analytics (`lib/analytics.ts`), AI Teacher diagnostics (`lib/teacher-coach.ts`), and immutable trade history.
 */

import { computeAnalytics, exportJournalToCsv } from "./analytics";
import { ACADEMY_COURSES } from "./academy-courses";
import type { PaperAccountState } from "./paper-engine";
import { diagnoseTradingReport } from "./teacher-coach";

export type ReportKind =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "ANNUAL"
  | "COMPLETE_HISTORY"
  | "AI_TEACHER_MISTAKES"
  | "RISK_MANAGEMENT"
  | "TRADING_PSYCHOLOGY"
  | "STRATEGY_PERFORMANCE"
  | "PORTFOLIO_HOLDINGS"
  | "ACCOUNT_RESET_HISTORY"
  | "ACADEMY_PROGRESS"
  | "COMPLETE_ACCOUNT_BUNDLE";

export const REPORT_CATALOG: Array<{ id: ReportKind; title: string; subtitle: string }> = [
  { id: "DAILY", title: "Daily Trading Report", subtitle: "Today's executions, realized P&L, charges, and teacher feedback." },
  { id: "WEEKLY", title: "Weekly Trading Report", subtitle: "Last 7 days performance, win rate, drawdown, and discipline review." },
  { id: "MONTHLY", title: "Monthly Trading Report", subtitle: "Last 30 days net edge, strategy summary, and improvement score." },
  { id: "ANNUAL", title: "Annual Trading Report", subtitle: "Full-year simulated performance, tax bucket summary, and charges." },
  { id: "COMPLETE_HISTORY", title: "Complete Trading History", subtitle: "Every closed simulated trade with entry/exit, strategy, emotion & notes." },
  { id: "AI_TEACHER_MISTAKES", title: "AI Teacher Mistake Report", subtitle: "8-point diagnosis of every detected mistake, weakness profile & homework." },
  { id: "RISK_MANAGEMENT", title: "Risk Management Report", subtitle: "Configured risk limits, drawdown, margin utilization & capital protection." },
  { id: "TRADING_PSYCHOLOGY", title: "Trading Psychology Report", subtitle: "Emotional patterns, fear/greed/stress self-check logs & daily reflections." },
  { id: "STRATEGY_PERFORMANCE", title: "Strategy Performance Report", subtitle: "Expectancy, win rate, and net P&L grouped by trading strategy." },
  { id: "PORTFOLIO_HOLDINGS", title: "Portfolio & Holdings Report", subtitle: "Virtual cash, open intraday positions, delivery holdings, and margin." },
  { id: "ACCOUNT_RESET_HISTORY", title: "Account Reset & Refill History", subtitle: "Immutable ledger of every auto/manual virtual capital refill & date." },
  { id: "ACADEMY_PROGRESS", title: "Trading Academy Progress Report", subtitle: "Completed courses across the 28-course bilingual curriculum & quiz scores." },
  { id: "COMPLETE_ACCOUNT_BUNDLE", title: "Complete Full-Account Master Report", subtitle: "All 12 sections combined into one comprehensive downloadable PDF/Excel/CSV report." },
];

export function filterAccountByDateRange(
  account: PaperAccountState,
  fromDate: string,
  toDate: string
): PaperAccountState {
  if (!fromDate && !toDate) return account;
  const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00Z`) : -Infinity;
  const toTs = toDate ? Date.parse(`${toDate}T23:59:59Z`) : Infinity;
  return {
    ...account,
    journal: account.journal.filter((t) => {
      const ts = Date.parse(t.closedAt);
      return ts >= fromTs && ts <= toTs;
    }),
  };
}

export function buildReportHtml(
  kind: ReportKind,
  studentName: string,
  account: PaperAccountState,
  fromDate: string,
  toDate: string
): string {
  const scoped = applyPeriodFilter(kind, filterAccountByDateRange(account, fromDate, toDate));
  const stats = computeAnalytics(scoped);
  const teacher = diagnoseTradingReport(scoped);
  const meta = REPORT_CATALOG.find((r) => r.id === kind) ?? REPORT_CATALOG[0];
  const esc = (v: string | number) =>
    String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const tradeRows =
    scoped.journal.length === 0
      ? `<tr><td colspan="7" style="text-align:center;color:#778;">No closed simulated trades in selected period.</td></tr>`
      : scoped.journal
          .map(
            (t) =>
              `<tr><td><strong>${esc(t.symbol)}</strong> (${t.side})</td><td>${t.quantity}</td><td>₹${t.entryPrice} → ₹${t.exitPrice}</td><td>${esc(t.strategy)}</td><td>${esc(t.emotion)}</td><td>₹${t.charges.toFixed(2)}</td><td style="font-weight:700;color:${t.netPnl >= 0 ? "#17613f" : "#b84739"}">${t.netPnl >= 0 ? "+" : ""}₹${t.netPnl.toFixed(2)}</td></tr>`
          )
          .join("");

  const mistakeRows =
    teacher.mistakes.length === 0
      ? `<p class="box-ok">Zero critical mistakes detected in this period.</p>`
      : teacher.mistakes
          .map(
            (m) => `
        <div class="m-card">
          <h4>[${m.severity}] ${esc(m.title)}</h4>
          <p><strong>1. What you did:</strong> ${esc(m.whatYouDid)}</p>
          <p><strong>2. What was incorrect:</strong> ${esc(m.whatWasIncorrect)}</p>
          <p><strong>3. Why problematic:</strong> ${esc(m.whyProblematic)}</p>
          <p><strong>4. What you should have done:</strong> ${esc(m.whatYouShouldHaveDone)}</p>
          <p><strong>5. How to avoid repeating:</strong> ${m.howToAvoidRepeating.map(esc).join(" · ")}</p>
          <p><strong>6. Practical example:</strong> ${esc(m.practicalExample)}</p>
          <p><strong>7. Recommended lesson:</strong> ${esc(m.recommendedLesson)} | <strong>8. Exercise:</strong> ${esc(m.practiceExercise)}</p>
        </div>`
          )
          .join("");

  const refillRows =
    account.refillHistory.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:#778;">No refills recorded yet (Default ₹10,00,000 balance active).</td></tr>`
      : account.refillHistory
          .map(
            (r) =>
              `<tr><td>${new Date(r.date).toLocaleString("en-IN")}</td><td>${r.mode}</td><td>₹${r.balanceBefore.toLocaleString("en-IN")}</td><td>+₹${r.amountAdded.toLocaleString("en-IN")}</td><td>${esc(r.reason)}</td></tr>`
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>TradeGuru AI — ${esc(meta.title)}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f8f6;color:#18231d;margin:0;padding:24px}
  .sheet{max-width:960px;margin:0 auto;background:#fff;border:1px solid #dfe7e1;border-radius:10px;padding:30px}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #17613f;padding-bottom:14px;margin-bottom:18px}
  .brand{font-size:21px;font-weight:800;color:#17613f}
  .grade{background:#17613f;color:#fff;padding:10px 18px;border-radius:8px;text-align:center}
  .grade strong{display:block;font-size:26px;line-height:1}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
  .kpi{background:#f7faf7;border:1px solid #e4ece5;border-radius:6px;padding:10px}
  .kpi span{display:block;font-size:9px;color:#6c7b71;text-transform:uppercase}
  .kpi strong{font-size:17px}
  h3{color:#17613f;border-bottom:1px solid #edf2ed;padding-bottom:5px;margin:20px 0 8px;font-size:15px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
  th,td{border-bottom:1px solid #e9eee9;padding:7px;text-align:left}
  th{background:#f7faf7;color:#607066;font-size:9.5px;text-transform:uppercase}
  .m-card{border-left:4px solid #b84739;background:#fff9f8;padding:10px 14px;border-radius:6px;margin-bottom:10px;font-size:11.5px;line-height:1.5}
  .m-card h4{margin:0 0 6px;font-size:13px}
  .m-card p{margin:3px 0}
  .box-ok{background:#edf6ef;color:#17613f;padding:10px 12px;border-radius:6px;font-size:12px}
  .foot{margin-top:20px;padding-top:10px;border-top:1px solid #e5ece6;font-size:10px;color:#7c8a80;display:flex;justify-content:space-between}
  @media print{body{background:#fff;padding:0}.sheet{border:0}}
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">TradeGuru AI · ${esc(meta.title)}</div>
        <div style="font-size:11.5px;color:#5f6f65;margin-top:4px">Trader: <strong>${esc(studentName)}</strong> · Period: ${esc(fromDate || "All")} to ${esc(toDate || "Today")} · Generated ${new Date().toLocaleString("en-IN")}</div>
      </div>
      <div class="grade"><strong>${teacher.grade}</strong><span style="font-size:10px">Discipline ${teacher.disciplineScore}/100</span></div>
    </div>

    <div class="kpis">
      <div class="kpi"><span>Closed Trades</span><strong>${stats.totalTrades}</strong></div>
      <div class="kpi"><span>Win Rate / PF</span><strong>${stats.winRate.toFixed(1)}% · ${stats.profitFactor}</strong></div>
      <div class="kpi"><span>Expectancy / Trade</span><strong>₹${stats.expectancyPerTrade.toLocaleString("en-IN")}</strong></div>
      <div class="kpi"><span>Net P&amp;L (After Costs)</span><strong>₹${stats.netPnl.toLocaleString("en-IN")}</strong></div>
    </div>

    <h3>AI Teacher Diagnosis &amp; Improvement Plan</h3>
    <p style="font-size:12px">${esc(teacher.headline)}</p>
    ${mistakeRows}

    <h3>Trade Execution Ledger</h3>
    <table>
      <thead><tr><th>Instrument</th><th>Qty</th><th>Entry → Exit</th><th>Strategy</th><th>Emotion</th><th>Charges</th><th>Net P&amp;L</th></tr></thead>
      <tbody>${tradeRows}</tbody>
    </table>

    <h3>Account Refill &amp; Reset History (Immutable)</h3>
    <table>
      <thead><tr><th>Date</th><th>Mode</th><th>Balance Before</th><th>Added</th><th>Reason</th></tr></thead>
      <tbody>${refillRows}</tbody>
    </table>

    <h3>Trading Academy Progress</h3>
    <p style="font-size:12px">Completed <strong>${account.completedCourseIds.length} / ${ACADEMY_COURSES.length}</strong> bilingual courses · Personal Weakness Profile: ${esc(teacher.weaknessProfile.join(", "))}</p>

    <div class="foot">
      <span>TradeGuru AI — 100% Free Educational Paper Trading Ecosystem</span>
      <span>Simulated execution data only. Not SEBI-registered investment advice.</span>
    </div>
  </div>
</body>
</html>`;
}

export function buildReportCsv(
  kind: ReportKind,
  account: PaperAccountState,
  fromDate: string,
  toDate: string
): string {
  const scoped = applyPeriodFilter(kind, filterAccountByDateRange(account, fromDate, toDate));
  if (kind === "ACCOUNT_RESET_HISTORY") {
    const header = "Refill ID,Date,Mode,Balance Before,Amount Added,Balance After,Reason";
    const rows = account.refillHistory.map(
      (r) => `"${r.id}","${r.date}","${r.mode}",${r.balanceBefore},${r.amountAdded},${r.balanceAfter},"${r.reason.replaceAll('"', '""')}"`
    );
    return [header, ...rows].join("\n");
  }
  if (kind === "ACADEMY_PROGRESS") {
    const header = "Course #,Title,Tier,Completed";
    const rows = ACADEMY_COURSES.map(
      (c) => `${c.number},"${c.titleEn}","${c.tier}",${account.completedCourseIds.includes(c.id) ? "YES" : "NO"}`
    );
    return [header, ...rows].join("\n");
  }
  return exportJournalToCsv(scoped.journal);
}

/**
 * Generates an Excel-compatible SpreadsheetML (.xls) file readable natively in Microsoft Excel & Google Sheets.
 */
export function buildExcelCompatibleXml(
  kind: ReportKind,
  account: PaperAccountState,
  fromDate: string,
  toDate: string
): string {
  const csv = buildReportCsv(kind, account, fromDate, toDate);
  const lines = csv.split("\n").map((line) =>
    line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((cell) => cell.replace(/^"|"$/g, "").replaceAll('""', '"'))
  );
  const esc = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const rowsXml = lines
    .map(
      (cols) =>
        `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join("")}</Row>`
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="TradeGuruReport">
    <Table>${rowsXml}</Table>
  </Worksheet>
</Workbook>`;
}

function applyPeriodFilter(kind: ReportKind, account: PaperAccountState): PaperAccountState {
  const now = Date.now();
  const dayMs = 86400000;
  let cutoff = -Infinity;
  if (kind === "DAILY") cutoff = now - dayMs;
  else if (kind === "WEEKLY") cutoff = now - dayMs * 7;
  else if (kind === "MONTHLY") cutoff = now - dayMs * 30;
  else if (kind === "ANNUAL") cutoff = now - dayMs * 365;
  if (cutoff === -Infinity) return account;
  return {
    ...account,
    journal: account.journal.filter((t) => Date.parse(t.closedAt) >= cutoff),
  };
}
