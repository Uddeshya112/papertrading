"use client";

import { useState } from "react";
import type { PaperAccountState } from "@/lib/paper-engine";
import {
  buildExcelCompatibleXml,
  buildReportCsv,
  buildReportHtml,
  REPORT_CATALOG,
  type ReportKind,
} from "@/lib/report-center";

type Props = {
  studentName: string;
  account: PaperAccountState;
};

export function ReportsCenterView({ studentName, account }: Props) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPrintPdf(kind: ReportKind) {
    const html = buildReportHtml(kind, studentName, account, fromDate, toDate);
    const win = window.open("", "_blank", "width=980,height=820");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="nt-stack">
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">12 DOWNLOADABLE REPORTS · REAL STORED DATA ONLY</span>
            <h2>Professional Trading Report Center</h2>
            <p>Generate PDF (print-ready), CSV, or Excel-compatible reports using your actual simulated trades, AI Teacher feedback, and immutable refill ledger.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => openPrintPdf("COMPLETE_ACCOUNT_BUNDLE")}
          >
            Download Complete Account PDF
          </button>
        </div>

        <div className="nt-calc-form" style={{ maxWidth: 520 }}>
          <label>
            From Date (optional)
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label>
            To Date (optional)
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
      </section>

      <div className="nt-pillars-grid">
        {REPORT_CATALOG.map((rep) => (
          <article key={rep.id} className="surface-card nt-stack" style={{ gap: 10 }}>
            <div>
              <span className="card-kicker">{rep.id.replaceAll("_", " ")}</span>
              <h3 style={{ margin: "4px 0 4px", fontFamily: "var(--display)", fontSize: 15 }}>{rep.title}</h3>
              <p className="nt-muted-sm">{rep.subtitle}</p>
            </div>
            <div className="nt-inline-actions">
              <button type="button" className="nt-pill active" onClick={() => openPrintPdf(rep.id)}>
                PDF / Print
              </button>
              <button
                type="button"
                className="nt-pill"
                onClick={() =>
                  downloadFile(
                    buildReportCsv(rep.id, account, fromDate, toDate),
                    `TradeGuru-${rep.id}-${stamp}.csv`,
                    "text/csv;charset=utf-8;"
                  )
                }
              >
                CSV
              </button>
              <button
                type="button"
                className="nt-pill"
                onClick={() =>
                  downloadFile(
                    buildExcelCompatibleXml(rep.id, account, fromDate, toDate),
                    `TradeGuru-${rep.id}-${stamp}.xls`,
                    "application/vnd.ms-excel"
                  )
                }
              >
                Excel (.xls)
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
