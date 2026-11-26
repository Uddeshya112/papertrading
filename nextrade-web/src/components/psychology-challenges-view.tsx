"use client";

import { useMemo, useState } from "react";
import type { PaperAccountState, PsychologyLog } from "@/lib/paper-engine";
import { diagnoseTradingReport } from "@/lib/teacher-coach";

type Props = {
  studentName: string;
  account: PaperAccountState;
  onAddPsychologyLog: (log: Omit<PsychologyLog, "id" | "date">) => void;
};

type ChallengeDef = {
  id: string;
  title: string;
  xp: number;
  focus: string;
  progress: (acc: PaperAccountState) => { current: number; target: number };
};

const CHALLENGES: ChallengeDef[] = [
  { id: "ch1", title: "7-Day Discipline Challenge", xp: 250, focus: "Discipline", progress: (a) => ({ current: Math.min(7, new Set(a.journal.map((t) => t.closedAt.slice(0, 10))).size), target: 7 }) },
  { id: "ch2", title: "30-Day Trading Improvement Challenge", xp: 600, focus: "Consistency", progress: (a) => ({ current: Math.min(30, a.journal.length), target: 30 }) },
  { id: "ch3", title: "Risk Management Challenge", xp: 300, focus: "Capital Protection", progress: (a) => ({ current: a.journal.filter((t) => t.followedStopLoss).length, target: 10 }) },
  { id: "ch4", title: "Stop Loss Discipline Challenge", xp: 250, focus: "Stop Loss", progress: (a) => ({ current: a.orders.filter((o) => Boolean(o.stopLossPrice)).length, target: 10 }) },
  { id: "ch5", title: "No Overtrading Challenge", xp: 200, focus: "Patience", progress: (a) => ({ current: a.journal.length > 0 ? Math.min(5, new Set(a.journal.map((t) => t.closedAt.slice(0, 10))).size) : 0, target: 5 }) },
  { id: "ch6", title: "Strategy Consistency Challenge", xp: 300, focus: "Process", progress: (a) => ({ current: a.journal.filter((t) => t.strategy !== "No Strategy (Impulse)").length, target: 15 }) },
  { id: "ch7", title: "Beginner Trading Challenge", xp: 150, focus: "Education", progress: (a) => ({ current: Math.min(7, a.completedCourseIds.length), target: 7 }) },
  { id: "ch8", title: "Technical Analysis Challenge", xp: 300, focus: "Chart Skills", progress: (a) => ({ current: Math.min(18, a.completedCourseIds.length), target: 18 }) },
  { id: "ch9", title: "Backtesting Challenge", xp: 250, focus: "Research", progress: (a) => ({ current: a.completedCourseIds.includes("c27") ? 1 : 0, target: 1 }) },
  { id: "ch10", title: "Trading Journal Challenge", xp: 250, focus: "Reflection", progress: (a) => ({ current: a.journal.filter((t) => t.reflection.trim().length > 0).length, target: 10 }) },
];

export function PsychologyChallengesView({ studentName, account, onAddPsychologyLog }: Props) {
  const [fearScore, setFearScore] = useState(2);
  const [greedScore, setGreedScore] = useState(2);
  const [stressScore, setStressScore] = useState(2);
  const [patienceScore, setPatienceScore] = useState(4);
  const [dailyReflection, setDailyReflection] = useState("");

  const teacher = useMemo(() => diagnoseTradingReport(account), [account]);

  const challengeStats = useMemo(() => {
    let totalXp = account.completedCourseIds.length * 40 + account.psychologyLogs.length * 30;
    const items = CHALLENGES.map((c) => {
      const p = c.progress(account);
      const completed = p.current >= p.target;
      if (completed) totalXp += c.xp;
      return { ...c, ...p, completed, pct: Math.min(100, Math.round((p.current / p.target) * 100)) };
    });
    const level = Math.floor(totalXp / 300) + 1;
    const completedCount = items.filter((i) => i.completed).length;
    return { items, totalXp, level, completedCount };
  }, [account]);

  function submitPsychLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onAddPsychologyLog({
      fearScore,
      greedScore,
      stressScore,
      patienceScore,
      dailyReflection: dailyReflection.trim() || "Practiced calm, rule-based execution today.",
    });
    setDailyReflection("");
  }

  function printCertificate() {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>TradeGuru AI Certificate</title><style>body{font-family:Georgia,serif;background:#f4f7f4;padding:40px;text-align:center}.cert{max-width:760px;margin:0 auto;background:#fff;border:8px double #17613f;padding:48px;border-radius:12px}h1{color:#17613f;font-size:32px;margin:8px 0}h2{font-size:24px;color:#18231d;margin:18px 0}p{font-family:Arial,sans-serif;font-size:14px;color:#4f5e54;line-height:1.6}</style></head><body><div class="cert"><p style="letter-spacing:2px;font-weight:700;color:#17613f">TRADEGURU AI · EDUCATIONAL CERTIFICATE OF DISCIPLINE</p><h1>Certificate of Achievement</h1><p>This certifies that</p><h2>${studentName}</h2><p>has achieved <strong>Level ${challengeStats.level} (${challengeStats.totalXp} XP)</strong>, completed <strong>${account.completedCourseIds.length}/28 Academy Courses</strong>, and earned a <strong>Discipline Score of ${teacher.disciplineScore}/100</strong> in disciplined paper trading practice.</p><p style="margin-top:32px;font-size:11px;color:#7a887e">Issued ${new Date().toLocaleDateString("en-IN")} · 100% Free Educational Simulator</p></div></body></html>`;
    const win = window.open("", "_blank", "width=860,height=640");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 250);
  }

  return (
    <div className="nt-stack">
      {/* Level, XP & Discipline Score */}
      <div className="nt-kpi-grid">
        <div className="surface-card nt-kpi">
          <span className="card-kicker">TRADER LEVEL &amp; XP</span>
          <strong>Level {challengeStats.level} · {challengeStats.totalXp} XP</strong>
          <small>Earned via discipline, stop-loss &amp; learning (never reckless profits)</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">DISCIPLINE SCORE</span>
          <strong className="nt-pos">{teacher.disciplineScore}/100</strong>
          <small>Good Process Losses credited: {teacher.goodProcessLosses}</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">CHALLENGES COMPLETED</span>
          <strong>{challengeStats.completedCount} / {CHALLENGES.length}</strong>
          <small>Badges unlocked across 10 structured tracks</small>
        </div>
        <div className="surface-card nt-kpi">
          <span className="card-kicker">CERTIFICATE</span>
          <button type="button" className="primary-button" onClick={printCertificate} style={{ marginTop: 4 }}>
            Print Discipline Certificate
          </button>
          <small>Printable educational achievement record</small>
        </div>
      </div>

      {/* Trading Psychology Lab */}
      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">TRADING PSYCHOLOGY LAB · SELF-AWARENESS ONLY</span>
              <h2>Daily Mindset &amp; Habit Questionnaire</h2>
              <p>Educational habit tracking for fear, greed, patience, and consecutive-loss recovery (never diagnoses medical conditions).</p>
            </div>
          </div>
          <form className="nt-order-form" onSubmit={submitPsychLog}>
            <div className="nt-form-row">
              <label>Fear Level (1 Calm – 5 High)<input type="number" min={1} max={5} value={fearScore} onChange={(e) => setFearScore(Number(e.target.value) || 1)} /></label>
              <label>Greed / FOMO Urge (1 Low – 5 High)<input type="number" min={1} max={5} value={greedScore} onChange={(e) => setGreedScore(Number(e.target.value) || 1)} /></label>
            </div>
            <div className="nt-form-row">
              <label>Trading Stress (1 Low – 5 High)<input type="number" min={1} max={5} value={stressScore} onChange={(e) => setStressScore(Number(e.target.value) || 1)} /></label>
              <label>Patience &amp; Plan Adherence (1 – 5 Best)<input type="number" min={1} max={5} value={patienceScore} onChange={(e) => setPatienceScore(Number(e.target.value) || 4)} /></label>
            </div>
            <label>
              Daily Reflection &amp; Consecutive-Loss Recovery Note
              <input value={dailyReflection} onChange={(e) => setDailyReflection(e.target.value)} placeholder="Did I wait for my setup? How did I react after a stop-loss?" />
            </label>
            <button type="submit" className="primary-button">Log Psychology Check-In (+30 XP)</button>
          </form>
        </section>

        <section className="surface-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">RECENT MINDSET LOGS</span>
              <h2>Emotional Habit History ({account.psychologyLogs.length})</h2>
            </div>
          </div>
          {account.psychologyLogs.length === 0 ? (
            <p className="market-api-muted">Complete your first check-in on the left to start tracking fear, greed, patience, and stress patterns.</p>
          ) : (
            <div className="nt-check-list">
              {account.psychologyLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="nt-check-item">
                  <span className="nt-check-dot">◎</span>
                  <div>
                    <strong>{new Date(log.date).toLocaleDateString("en-IN")} · Patience {log.patienceScore}/5</strong>
                    <p>Fear {log.fearScore}/5 · Greed {log.greedScore}/5 · Stress {log.stressScore}/5 — {log.dailyReflection}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 10 Discipline-First Challenges */}
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <span className="card-kicker">DISCIPLINE-FIRST CHALLENGES &amp; ACHIEVEMENTS</span>
            <h2>10 Structured Trading Challenges</h2>
          </div>
        </div>
        <div className="nt-pillars-grid">
          {challengeStats.items.map((ch) => (
            <div key={ch.id} className="nt-pillar-card">
              <div className="nt-pillar-head">
                <strong>{ch.title}</strong>
                <span className="source-tag">{ch.completed ? "Unlocked ✓" : `+${ch.xp} XP`}</span>
              </div>
              <div className="nt-bar-track">
                <div className="nt-bar-fill" style={{ width: `${ch.pct}%`, background: ch.completed ? "#17613f" : "#4b9e6a" }} />
              </div>
              <small>{ch.focus} · {ch.current} / {ch.target}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
