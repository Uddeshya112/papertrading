"use client";

import { useMemo, useState } from "react";
import type { PaperAccountState } from "@/lib/paper-engine";
import { buildReportHtml } from "@/lib/report-center";
import {
  CLASSROOM_LESSONS,
  diagnoseTradingReport,
  TEACHER_QUIZ,
} from "@/lib/teacher-coach";

type Props = {
  studentName: string;
  account: PaperAccountState;
  teacherMode: boolean;
  onToggleTeacherMode: () => void;
  onNavigateView: (view: string) => void;
};

export function TeacherCoachView({
  studentName,
  account,
  teacherMode,
  onToggleTeacherMode,
  onNavigateView,
}: Props) {
  const [subTab, setSubTab] = useState<"MISTAKES" | "CLASSROOM" | "QUIZ">("MISTAKES");
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const report = useMemo(() => diagnoseTradingReport(account), [account]);

  function printPdfReport() {
    const html = buildReportHtml("AI_TEACHER_MISTAKES", studentName, account, "", "");
    const win = window.open("", "_blank", "width=960,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
  }

  function downloadHtmlReport() {
    const html = buildReportHtml("AI_TEACHER_MISTAKES", studentName, account, "", "");
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TradeGuru-AI-Teacher-Report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const completedLevels = CLASSROOM_LESSONS.filter((l) => l.checkCompleted(account)).length;

  return (
    <div className="nt-stack">
      {/* Header Banner */}
      <section className="surface-card nt-teacher-banner">
        <div>
          <div className="nt-inline-actions" style={{ marginBottom: 6 }}>
            <span className="nt-free-badge">100% FREE FOREVER · AI TRADING TEACHER</span>
            <span className="source-tag">
              Discipline: <strong>{report.disciplineScore}/100</strong> · Improvement: <strong>{report.improvementScore}/100</strong>
            </span>
          </div>
          <h2 style={{ margin: "4px 0 6px", fontFamily: "var(--display)", fontSize: 20 }}>
            Personal Trading Instructor &amp; 16-Mistake Diagnosis Lab
          </h2>
          <p className="nt-prose">
            Evaluates every trade against your strategy and risk rules—never assuming a losing trade is bad if your process was disciplined ({report.goodProcessLosses} Good Process Loss(es) credited).
          </p>
        </div>
        <div className="nt-teacher-actions">
          <button type="button" className="primary-button" onClick={onToggleTeacherMode}>
            {teacherMode ? "Pre-Trade Guardrails: ON ✓" : "Turn ON Pre-Trade Guardrails"}
          </button>
          <div className="nt-grade-pill">
            <span>GRADE</span>
            <strong>{report.grade}</strong>
            <small>{report.overallScore}/100</small>
          </div>
        </div>
      </section>

      {/* Daily / Weekly / Monthly Reviews */}
      <div className="nt-steps-grid">
        <div className="surface-card nt-step-card">
          <strong>Daily Teacher Feedback</strong>
          <p>{report.dailyFeedback}</p>
        </div>
        <div className="surface-card nt-step-card">
          <strong>Weekly Performance Review</strong>
          <p>{report.weeklyReview}</p>
        </div>
        <div className="surface-card nt-step-card">
          <strong>Monthly Improvement Summary</strong>
          <p>{report.monthlyReport}</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="nt-inline-actions">
        <button type="button" className={`nt-pill${subTab === "MISTAKES" ? " active" : ""}`} onClick={() => setSubTab("MISTAKES")}>
          8-Point Mistake Lab &amp; Report ({report.mistakes.length})
        </button>
        <button type="button" className={`nt-pill${subTab === "CLASSROOM" ? " active" : ""}`} onClick={() => setSubTab("CLASSROOM")}>
          Guided Classroom ({completedLevels}/{CLASSROOM_LESSONS.length})
        </button>
        <button type="button" className={`nt-pill${subTab === "QUIZ" ? " active" : ""}`} onClick={() => setSubTab("QUIZ")}>
          Personalized Quiz ({Object.keys(answers).length}/{TEACHER_QUIZ.length})
        </button>
      </div>

      {subTab === "MISTAKES" && (
        <div className="nt-stack">
          {report.repeatedMistakeAlerts.length > 0 && (
            <article className="truth-card" style={{ background: "#fff6f5", borderColor: "#f0d0cb" }}>
              <span className="truth-icon" style={{ background: "#f7dcd8", color: "#b84739" }}>!</span>
              <div>
                <strong>Repeated Mistake Alerts</strong>
                <p>{report.repeatedMistakeAlerts.join(" · ")}</p>
              </div>
            </article>
          )}

          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">WEAKNESS PROFILE: {report.weaknessProfile.join(" · ")}</span>
                <h2>{report.headline}</h2>
              </div>
              <div className="nt-inline-actions">
                <button type="button" className="primary-button" onClick={printPdfReport}>Print / Save PDF</button>
                <button type="button" className="nt-pill active" onClick={downloadHtmlReport}>Download HTML Report</button>
                <button type="button" className="nt-pill" onClick={() => onNavigateView("Reports Center")}>All 12 Reports →</button>
              </div>
            </div>

            <div className="nt-pillars-grid">
              {report.pillars.map((pillar) => (
                <div key={pillar.key} className="nt-pillar-card">
                  <div className="nt-pillar-head">
                    <strong>{pillar.label}</strong>
                    <span className={pillar.score >= 75 ? "nt-pos" : pillar.score >= 50 ? "" : "nt-neg"}>
                      {pillar.score}/100 · {pillar.status}
                    </span>
                  </div>
                  <div className="nt-bar-track">
                    <div
                      className="nt-bar-fill"
                      style={{
                        width: `${pillar.score}%`,
                        background: pillar.score >= 75 ? "#17613f" : pillar.score >= 50 ? "#c7851c" : "#b84739",
                      }}
                    />
                  </div>
                  <small>{pillar.teacherNote}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">8-POINT EDUCATIONAL DIAGNOSIS</span>
                <h2>Detected Mistakes &amp; Exact Remedies ({report.mistakes.length})</h2>
              </div>
            </div>

            {report.mistakes.length === 0 ? (
              <div className="nt-good-box">
                <strong>Clean execution so far — zero critical mistakes flagged!</strong>
                <p>Keep placing simulated trades across different market regimes so your AI Teacher can validate consistency over 50+ trades.</p>
              </div>
            ) : (
              <div className="nt-stack">
                {report.mistakes.map((m) => (
                  <article key={m.id} className={`nt-mistake-card ${m.severity.toLowerCase()}`}>
                    <div className="nt-inline-actions" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                      <span className="nt-badge sell">{m.severity} · {m.category}{m.isRepeated ? " · REPEATED" : ""}</span>
                      <span className="source-tag">{m.affectedTrades} trade(s)</span>
                    </div>
                    <h3>{m.title}</h3>
                    <p><strong>1. What you did:</strong> {m.whatYouDid}</p>
                    <p><strong>2. What was incorrect:</strong> {m.whatWasIncorrect}</p>
                    <p><strong>3. Why it was problematic:</strong> {m.whyProblematic}</p>
                    <p><strong>4. What you should have done:</strong> {m.whatYouShouldHaveDone}</p>
                    <div className="nt-improve-box">
                      <strong>5. How to avoid repeating it:</strong>
                      <ul>{m.howToAvoidRepeating.map((step) => <li key={step}>{step}</li>)}</ul>
                      <p style={{ marginTop: 6 }}><strong>6. Practical example:</strong> {m.practicalExample}</p>
                      <p><strong>7. Recommended lesson:</strong> {m.recommendedLesson}</p>
                      <p><strong>8. Practice exercise:</strong> {m.practiceExercise}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="surface-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">PERSONAL HOMEWORK</span>
                <h2>Your Teacher Action Plan</h2>
              </div>
            </div>
            <ol className="nt-bullet-list">
              {report.homework.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        </div>
      )}

      {subTab === "CLASSROOM" && (
        <div className="nt-stack">
          {CLASSROOM_LESSONS.map((lesson) => {
            const done = lesson.checkCompleted(account);
            return (
              <section key={lesson.level} className={`surface-card nt-lesson-card${done ? " done" : ""}`}>
                <div className="card-heading">
                  <div>
                    <span className="card-kicker">MODULE {lesson.level} · {done ? "COMPLETED ✓" : "ACTIVE"}</span>
                    <h2>{lesson.title}</h2>
                    <p>{lesson.subtitle}</p>
                  </div>
                  <button type="button" className={done ? "nt-pill active" : "primary-button"} onClick={() => onNavigateView(lesson.targetView)}>
                    {done ? "Practice Again →" : `Open ${lesson.targetView} →`}
                  </button>
                </div>
                <p className="nt-prose" style={{ marginBottom: 8 }}>{lesson.teacherExplanation}</p>
                <div className="nt-mission-strip">
                  <span>{done ? "✓ Mission Verified:" : "◎ Mission:"}</span>
                  <strong>{lesson.missionLabel}</strong>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {subTab === "QUIZ" && (
        <div className="nt-stack">
          {TEACHER_QUIZ.map((q, idx) => {
            const picked = answers[q.id];
            const answered = picked !== undefined;
            const correct = picked === q.correctIndex;
            return (
              <section key={q.id} className="surface-card">
                <span className="card-kicker">QUESTION {idx + 1} OF {TEACHER_QUIZ.length}</span>
                <h3 style={{ margin: "6px 0 12px", fontFamily: "var(--display)", fontSize: 15 }}>{q.question}</h3>
                <div className="nt-quiz-options">
                  {q.options.map((opt, optIdx) => (
                    <button
                      key={opt}
                      type="button"
                      className={`nt-quiz-opt${picked === optIdx ? (optIdx === q.correctIndex ? " correct" : " wrong") : answered && optIdx === q.correctIndex ? " correct" : ""}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {answered && (
                  <div className={`nt-quiz-explain ${correct ? "correct" : "wrong"}`}>
                    <strong>{correct ? "Correct! Great discipline." : "Teacher Explanation:"}</strong>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
