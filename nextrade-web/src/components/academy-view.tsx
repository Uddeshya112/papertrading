"use client";

import { useMemo, useState } from "react";
import { ACADEMY_COURSES, type AcademyCourse, type CourseTier } from "@/lib/academy-courses";
import type { PaperAccountState } from "@/lib/paper-engine";

type Props = {
  account: PaperAccountState;
  onCompleteCourse: (courseId: string, quizScore: number) => void;
};

const TIERS: Array<CourseTier | "ALL"> = ["ALL", "Beginner", "Intermediate", "Technical & Risk", "Advanced"];

export function AcademyView({ account, onCompleteCourse }: Props) {
  const [lang, setLang] = useState<"EN" | "HI">("EN");
  const [tierFilter, setTierFilter] = useState<CourseTier | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>(ACADEMY_COURSES[0].id);
  const [pickedOption, setPickedOption] = useState<number | null>(null);

  const selected: AcademyCourse =
    ACADEMY_COURSES.find((c) => c.id === selectedId) ?? ACADEMY_COURSES[0];

  const filtered = useMemo(
    () => ACADEMY_COURSES.filter((c) => tierFilter === "ALL" || c.tier === tierFilter),
    [tierFilter]
  );

  const completedSet = new Set(account.completedCourseIds);
  const progressPct = Math.round((account.completedCourseIds.length / ACADEMY_COURSES.length) * 100);
  const prereqsMet = selected.prerequisiteIds.every((id) => completedSet.has(id));
  const isCompleted = completedSet.has(selected.id);
  const quiz = selected.quiz;

  function handleAnswer(idx: number) {
    setPickedOption(idx);
    if (idx === quiz.correctIndex) {
      onCompleteCourse(selected.id, 100);
    }
  }

  return (
    <div className="nt-stack">
      {/* Bilingual Header & Progress */}
      <section className="surface-card nt-teacher-banner">
        <div>
          <span className="nt-free-badge">28-COURSE TRADING ACADEMY · 100% FREE</span>
          <h2 style={{ margin: "6px 0 4px", fontFamily: "var(--display)", fontSize: 20 }}>
            {lang === "EN"
              ? "Zero-to-Advanced Stock Market Curriculum"
              : "शून्य से एडवांस तक — पूरा स्टॉक मार्केट पाठ्यक्रम"}
          </h2>
          <p className="nt-prose">
            {lang === "EN"
              ? "Explore any lesson freely at your own pace. Pass each chapter quiz to unlock structured Mastery badges across all 28 courses."
              : "आप किसी भी पाठ को स्वतंत्र रूप से पढ़ सकते हैं। सभी 28 कोर्स में मास्टरी बैज अनलॉक करने के लिए चैप्टर क्विज़ पास करें।"}
          </p>
        </div>
        <div className="nt-teacher-actions">
          <div className="nt-inline-actions">
            <button type="button" className={`nt-pill${lang === "EN" ? " active" : ""}`} onClick={() => setLang("EN")}>
              English
            </button>
            <button type="button" className={`nt-pill${lang === "HI" ? " active" : ""}`} onClick={() => setLang("HI")}>
              हिन्दी (Hindi)
            </button>
          </div>
          <div className="nt-grade-pill">
            <span>PROGRESS</span>
            <strong>{progressPct}%</strong>
            <small>{account.completedCourseIds.length}/28 Done</small>
          </div>
        </div>
      </section>

      {/* Tier Filters */}
      <div className="nt-inline-actions">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`nt-pill${tierFilter === tier ? " active" : ""}`}
            onClick={() => setTierFilter(tier)}
          >
            {tier === "ALL" ? `All 28 Courses` : tier}
          </button>
        ))}
      </div>

      {/* 2-Column Course Catalog + Interactive Lesson Reader */}
      <div className="nt-academy-grid">
        <aside className="surface-card nt-academy-list">
          {filtered.map((course) => {
            const done = completedSet.has(course.id);
            const unlocked = course.prerequisiteIds.every((id) => completedSet.has(id));
            return (
              <button
                key={course.id}
                type="button"
                className={`nt-watch-row${course.id === selected.id ? " selected" : ""}`}
                onClick={() => {
                  setSelectedId(course.id);
                  setPickedOption(null);
                }}
              >
                <div className="nt-watch-sym">
                  <strong>
                    {course.number}. {lang === "EN" ? course.titleEn : course.titleHi}
                  </strong>
                  <small>
                    {course.tier} · {done ? "Mastered ✓" : unlocked ? "Ready" : "Prereq recommended (Free to explore)"}
                  </small>
                </div>
                <span className="nt-check-dot">{done ? "✓" : course.number}</span>
              </button>
            );
          })}
        </aside>

        <section className="surface-card nt-stack">
          <div className="card-heading">
            <div>
              <span className="card-kicker">
                COURSE {selected.number} OF 28 · {selected.tier.toUpperCase()} {isCompleted ? "· COMPLETED ✓" : ""}
              </span>
              <h2>{lang === "EN" ? selected.titleEn : selected.titleHi}</h2>
              <p>{lang === "EN" ? selected.summaryEn : selected.summaryHi}</p>
            </div>
            {!prereqsMet && (
              <span className="source-tag">
                Prerequisite: {selected.prerequisiteIds.map((id) => id.toUpperCase()).join(", ")} (Free preview enabled)
              </span>
            )}
          </div>

          <div className="nt-step-card">
            <strong>{lang === "EN" ? "Core Lesson Takeaways" : "मुख्य पाठ बिंदु"}</strong>
            <ul className="nt-bullet-list" style={{ marginTop: 8 }}>
              {(lang === "EN" ? selected.lessonsEn : selected.lessonsHi).map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </div>

          <div className="nt-tax-box" style={{ marginTop: 0 }}>
            <span className="card-kicker">{lang === "EN" ? "CHART / PRACTICAL EXAMPLE" : "चार्ट और व्यावहारिक उदाहरण"}</span>
            <p style={{ marginTop: 6, fontWeight: 600 }}>{selected.chartExample}</p>
            <small>
              <strong>{lang === "EN" ? "Hands-on Exercise:" : "अभ्यास कार्य:"}</strong>{" "}
              {lang === "EN" ? selected.exerciseEn : selected.exerciseHi}
            </small>
          </div>

          {/* Chapter Quiz */}
          <div className="nt-step-card">
            <span className="card-kicker">{lang === "EN" ? "CHAPTER ASSESSMENT QUIZ" : "चैप्टर क्विज़"}</span>
            <h3 style={{ margin: "6px 0 10px", fontFamily: "var(--display)", fontSize: 14 }}>
              {lang === "EN" ? quiz.qEn : quiz.qHi}
            </h3>
            <div className="nt-quiz-options">
              {(lang === "EN" ? quiz.optionsEn : quiz.optionsHi).map((opt, idx) => (
                <button
                  key={opt}
                  type="button"
                  className={`nt-quiz-opt${pickedOption === idx ? (idx === quiz.correctIndex ? " correct" : " wrong") : pickedOption !== null && idx === quiz.correctIndex ? " correct" : ""}`}
                  onClick={() => handleAnswer(idx)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {pickedOption !== null && (
              <div className={`nt-quiz-explain ${pickedOption === quiz.correctIndex ? "correct" : "wrong"}`}>
                <strong>
                  {pickedOption === quiz.correctIndex
                    ? lang === "EN"
                      ? "Correct! Course marked completed."
                      : "सही उत्तर! कोर्स पूरा हो गया।"
                    : lang === "EN"
                      ? "Not quite — review this explanation:"
                      : "सही नहीं — यह व्याख्या पढ़ें:"}
                </strong>
                <p>{lang === "EN" ? quiz.explainEn : quiz.explainHi}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
