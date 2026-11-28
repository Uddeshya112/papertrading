/**
 * @module lib/teacher-coach
 * @description AI Trading Teacher & behavioral coaching engine detecting 16 trading mistakes with 8-point pedagogy.
 *
 * Pedagogical Design:
 * - Never equates a losing trade with a bad trade: explicitly credits "Good Process Losses" where the trader
 *   followed stop-loss and position-sizing rules.
 * - Returns an explicit `"Unrated"` state when `journal.length === 0` so new accounts never see arbitrary grades.
 * - Evaluates live pre-trade guardrails (`evaluatePreTradeMistakes`) before order submission.
 */

import { computeAnalytics } from "./analytics";
import { formatINR, plural } from "./format";
import type { EmotionTag, OrderSide, OrderType, PaperAccountState } from "./paper-engine";
import { getInstrumentById, type MarketSegment } from "./paper-instruments";

export type GuardrailLevel = "CRITICAL" | "WARNING" | "TIP" | "GOOD";

export type PreTradeFeedback = {
  id: string;
  level: GuardrailLevel;
  title: string;
  message: string;
  improvement: string;
};

/**
 * 8-Point Structured AI Teacher Mistake Breakdown
 */
export type MistakeDiagnosis = {
  id: string;
  severity: "CRITICAL" | "WARNING" | "COACHING";
  category: string;
  title: string;
  whatYouDid: string;
  whatWasIncorrect: string;
  whyProblematic: string;
  whatYouShouldHaveDone: string;
  howToAvoidRepeating: string[];
  practicalExample: string;
  recommendedLesson: string;
  practiceExercise: string;
  affectedTrades: number;
  isRepeated: boolean;
};

export type SkillPillar = {
  key: string;
  label: string;
  score: number;
  status: "Strong" | "Developing" | "Needs Focus";
  teacherNote: string;
};

export type TeacherReport = {
  generatedAt: string;
  overallScore: number;
  disciplineScore: number;
  improvementScore: number;
  goodProcessLosses: number;
  grade: "Unrated" | "A+" | "A" | "B+" | "B" | "C" | "D";
  headline: string;
  weaknessProfile: string[];
  repeatedMistakeAlerts: string[];
  dailyFeedback: string;
  weeklyReview: string;
  monthlyReport: string;
  pillars: SkillPillar[];
  mistakes: MistakeDiagnosis[];
  strengths: string[];
  homework: string[];
};

export type ClassroomLevel = {
  level: number;
  title: string;
  subtitle: string;
  teacherExplanation: string;
  keyRules: string[];
  missionLabel: string;
  targetView: string;
  checkCompleted: (account: PaperAccountState) => boolean;
};

export type TeacherQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export function evaluatePreTradeMistakes(params: {
  account: PaperAccountState;
  instrumentId: string;
  side: OrderSide;
  orderType: OrderType;
  entryPrice: number;
  quantity: number;
  stopLossPrice?: number;
  targetPrice?: number;
  emotion: EmotionTag;
  rationale: string;
}): PreTradeFeedback[] {
  const {
    account,
    instrumentId,
    side,
    entryPrice,
    quantity,
    stopLossPrice,
    targetPrice,
    emotion,
    rationale,
  } = params;
  const inst = getInstrumentById(instrumentId);
  const items: PreTradeFeedback[] = [];
  const limits = account.riskLimits;

  if (account.positions.length >= limits.maxOpenPositions) {
    items.push({
      id: "max_positions",
      level: "WARNING",
      title: `Open Position Limit Reached (${account.positions.length}/${limits.maxOpenPositions})`,
      message: "Managing too many simultaneous trades dilutes focus and compounds correlated drawdown.",
      improvement: "Close or review an existing position before adding another.",
    });
  }

  if (!stopLossPrice || stopLossPrice <= 0) {
    items.push({
      id: "no_sl",
      level: "CRITICAL",
      title: "Missing Stop-Loss",
      message: "Entering without a predefined stop-loss exposes your virtual capital to unlimited downside.",
      improvement: "Click 'Apply Teacher Fix' to attach a logical 1.5% stop-loss and 1:2 target automatically.",
    });
  } else {
    const slWrongSide =
      (side === "BUY" && stopLossPrice >= entryPrice) ||
      (side === "SELL" && stopLossPrice <= entryPrice);
    if (slWrongSide) {
      items.push({
        id: "sl_wrong_side",
        level: "CRITICAL",
        title: "Stop-Loss on Wrong Side of Entry",
        message: `For a ${side} at ₹${entryPrice}, Stop-Loss (₹${stopLossPrice}) must be ${side === "BUY" ? "below" : "above"} entry.`,
        improvement: `Place Stop-Loss ${side === "BUY" ? "below" : "above"} ₹${entryPrice}.`,
      });
    } else {
      const riskAmount = Math.abs(entryPrice - stopLossPrice) * quantity;
      const riskPct = account.startingCapital > 0 ? (riskAmount / account.startingCapital) * 100 : 0;
      if (riskPct > limits.maxRiskPerTradePct) {
        items.push({
          id: "oversized_risk",
          level: "CRITICAL",
          title: `Excessive Position Size (${riskPct.toFixed(2)}% > ${limits.maxRiskPerTradePct}% Limit)`,
          message: `You are risking ₹${riskAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on one trade, exceeding your configured ${limits.maxRiskPerTradePct}% risk limit.`,
          improvement: "Click 'Calc Qty' or 'Apply Teacher Fix' to resize safely to 1% risk.",
        });
      } else {
        items.push({
          id: "good_risk",
          level: "GOOD",
          title: `Disciplined Risk Sizing (${riskPct.toFixed(2)}% of Capital)`,
          message: `Planned max loss ₹${riskAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} stays within your ${limits.maxRiskPerTradePct}% risk rule.`,
          improvement: "Stick to this stop-loss without widening it if price pulls back.",
        });
      }

      if (targetPrice && targetPrice > 0) {
        const reward = Math.abs(targetPrice - entryPrice);
        const risk = Math.abs(entryPrice - stopLossPrice);
        const rr = risk > 0 ? reward / risk : 0;
        if (rr < 1.5) {
          items.push({
            id: "low_rr",
            level: "WARNING",
            title: `Poor Risk/Reward Ratio (1 : ${rr.toFixed(2)})`,
            message: "Targets below 1:1.5 R:R struggle to stay positive after Indian STT, GST, and stamp duty.",
            improvement: "Aim for at least 1:1.5 or 1:2 R:R before entering.",
          });
        }
      }
    }
  }

  if (["FOMO", "Revenge", "Fearful", "Greedy", "Hesitant"].includes(emotion)) {
    items.push({
      id: "emotional_trade",
      level: "CRITICAL",
      title: `Emotional Trading Alert (${emotion})`,
      message: `Trading while feeling ${emotion} overrides your written strategy and causes impulsive entries.`,
      improvement: "Step away for 2 minutes and verify your setup in the Trading Psychology Lab.",
    });
  }

  const isDerivative: MarketSegment[] = ["NSE_FUTURES", "NSE_OPTIONS", "MCX_COMMODITY"];
  if (isDerivative.includes(inst.segment) && account.journal.length < 5) {
    items.push({
      id: "beginner_fno",
      level: "WARNING",
      title: "High-Leverage Segment Early in Learning",
      message: "SEBI studies show 9 out of 10 individual F&O traders lose money.",
      improvement: "Practice 10+ cash equity trades first or use defined-risk hedged spreads in Basket Orders.",
    });
  }

  if (!rationale.trim()) {
    items.push({
      id: "no_rationale",
      level: "TIP",
      title: "Write Your Entry Reasoning",
      message: "Documenting why you entered lets the AI Teacher evaluate your decision quality objectively.",
      improvement: "Add 1 line describing your setup (e.g., '21-EMA pullback with rising volume').",
    });
  }

  return items;
}

/**
 * Comprehensive 16-Mistake AI Trading Teacher Engine with 8-Point Educational Breakdowns.
 * Never assumes every losing trade is a bad trade: disciplined losses are credited as Good Process Losses.
 */
export function diagnoseTradingReport(account: PaperAccountState): TeacherReport {
  const stats = computeAnalytics(account);
  const journal = account.journal;
  const total = journal.length;
  const mistakes: MistakeDiagnosis[] = [];
  const strengths: string[] = [];

  // Identify Good Process Losses (losing trades that followed strategy, SL, and calm emotion)
  const goodProcessLosses = journal.filter(
    (t) =>
      t.netPnl < 0 &&
      t.plannedStopLoss !== undefined &&
      t.followedStopLoss &&
      t.strategy !== "No Strategy (Impulse)" &&
      !["FOMO", "Revenge", "Greedy"].includes(t.emotion)
  ).length;

  if (goodProcessLosses > 0) {
    strengths.push(
      `${goodProcessLosses} losing trade(s) followed your Stop-Loss and strategy rules cleanly — Good Process Losses are a normal part of professional trading!`
    );
  }

  // 1. Missing Stop Loss
  const missingSl = journal.filter((t) => !t.plannedStopLoss);
  if (missingSl.length > 0) {
    mistakes.push({
      id: "m_missing_sl",
      severity: "CRITICAL",
      category: "Stop-Loss Discipline",
      title: `Missing Stop-Loss on ${missingSl.length} Trade(s)`,
      whatYouDid: `Entered ${missingSl.slice(0, 3).map((t) => t.symbol).join(", ")} without specifying a stop-loss price.`,
      whatWasIncorrect: "Leaving downside risk open-ended turns small pullbacks into account-damaging losses.",
      whyProblematic: "One unexpected gap or news spike in real NSE/F&O markets can erase months of disciplined gains.",
      whatYouShouldHaveDone: "Define your chart invalidation level and enter it into the Stop-Loss field before clicking Buy/Sell.",
      howToAvoidRepeating: [
        "Use Bracket or Cover orders to enforce stop-loss automatically.",
        "Keep Teacher Mode ON so pre-trade guardrails block unprotected orders.",
      ],
      practicalExample: "Entry ₹2,200 on HINDUNILVR with swing-low support at ₹2,165 -> attach SL at ₹2,165 before placing the order.",
      recommendedLesson: "Course 21: Stop Loss Strategies",
      practiceExercise: "Execute 5 consecutive cash equity trades with a predefined Stop-Loss attached at entry.",
      affectedTrades: missingSl.length,
      isRepeated: missingSl.length >= 2,
    });
  }

  // 2. Holding Losing Positions Without Plan / Trading Plan Violation
  const brokenSl = journal.filter((t) => t.plannedStopLoss !== undefined && !t.followedStopLoss);
  if (brokenSl.length > 0) {
    mistakes.push({
      id: "m_plan_violation",
      severity: "CRITICAL",
      category: "Trading Plan Violation",
      title: `Violated Stop-Loss / Held Loser Beyond Plan (${brokenSl.length} Trade(s))`,
      whatYouDid: `Exited worse than your planned stop-loss on ${brokenSl.slice(0, 3).map((t) => t.symbol).join(", ")}.`,
      whatWasIncorrect: "Hoping a losing trade would bounce back after invalidation broke your written trading plan.",
      whyProblematic: "Holding losers past stop-loss creates tail losses that destroy positive expectancy.",
      whatYouShouldHaveDone: "Accept the small pre-planned loss immediately when your invalidation level was hit.",
      howToAvoidRepeating: [
        "Never move a stop-loss further away once the trade is active.",
        "Remember: a small rule-following loss is a Good Process trade.",
      ],
      practicalExample: "If SL is ₹1,435 and price hits ₹1,435, exit immediately for ₹15/share loss rather than waiting until ₹1,390.",
      recommendedLesson: "Course 19: Risk Management & Course 23: Trading Psychology",
      practiceExercise: "Use automatic Bracket Orders for your next 10 simulated trades so exits are rule-driven.",
      affectedTrades: brokenSl.length,
      isRepeated: brokenSl.length >= 2,
    });
  }

  // 3. Excessive Position Sizing & Excessive Exposure
  const oversized = journal.filter(
    (t) =>
      t.entryPrice * t.quantity > account.startingCapital * 0.65 ||
      Math.abs(t.netPnl) > account.startingCapital * (account.riskLimits.maxRiskPerTradePct / 100) * 1.5
  );
  if (oversized.length > 0) {
    mistakes.push({
      id: "m_oversizing",
      severity: "CRITICAL",
      category: "Position Sizing & Exposure",
      title: `Excessive Position Sizing / Exposure (${oversized.length} Trade(s))`,
      whatYouDid: `Allocated oversized notional exposure on ${oversized.slice(0, 3).map((t) => t.symbol).join(", ")}.`,
      whatWasIncorrect: "Risking more than your configured per-trade limit magnifies emotional stress and drawdown.",
      whyProblematic: "A 50% drawdown requires a +100% return just to recover your starting capital.",
      whatYouShouldHaveDone: "Calculate quantity via Qty = (Capital × 1%) ÷ |Entry − Stop-Loss|.",
      howToAvoidRepeating: [
        "Use the built-in 'Calc Qty' risk sizer in the Pro Terminal on every trade.",
        "Keep single-trade risk at 1% (max 2%) and sector exposure under 35%.",
      ],
      practicalExample: "On ₹10,00,000 capital at 1% risk (₹10,000) with ₹40 SL distance -> buy 250 shares, not 1,000 shares.",
      recommendedLesson: "Course 20: Position Sizing",
      practiceExercise: "Open Risk Management Center and calculate exact quantities for 3 different stop distances.",
      affectedTrades: oversized.length,
      isRepeated: oversized.length >= 2,
    });
  }

  // 4. Trading Without a Strategy
  const noStrategy = journal.filter(
    (t) => t.strategy === "No Strategy (Impulse)" || !t.rationale.trim()
  );
  if (noStrategy.length > 0) {
    mistakes.push({
      id: "m_no_strategy",
      severity: "WARNING",
      category: "Strategy Discipline",
      title: `Trading Without a Clear Strategy (${noStrategy.length} Trade(s))`,
      whatYouDid: `Placed ${noStrategy.length} impulse trade(s) without a defined setup or entry reasoning.`,
      whatWasIncorrect: "Clicking buy/sell based on gut feeling cannot be repeated, measured, or improved.",
      whyProblematic: "Random entries behave like gambling and produce negative expectancy after transaction costs.",
      whatYouShouldHaveDone: "Wait for a rule-based setup (e.g., EMA Pullback, Support Breakout, RSI Momentum) and write 1 line of rationale.",
      howToAvoidRepeating: [
        "Build and backtest 1 clear rule-based strategy in the Backtesting Lab.",
        "Skip any trade that doesn't match your checklist.",
      ],
      practicalExample: "Write: '15m close above ₹1,745 resistance with 1.5x volume; SL below ₹1,725; Target ₹1,785.'",
      recommendedLesson: "Course 26: Strategy Building",
      practiceExercise: "Save 1 custom strategy in the Strategy Lab and take your next 5 trades using only that strategy.",
      affectedTrades: noStrategy.length,
      isRepeated: noStrategy.length >= 2,
    });
  }

  // 5. Emotional & Revenge Trading Patterns
  const emotional = journal.filter((t) =>
    ["FOMO", "Revenge", "Greedy", "Fearful", "Hesitant"].includes(t.emotion)
  );
  const revenge = journal.filter((t) => t.emotion === "Revenge");
  if (emotional.length > 0) {
    mistakes.push({
      id: "m_emotional",
      severity: revenge.length > 0 ? "CRITICAL" : "WARNING",
      category: "Trading Psychology",
      title:
        revenge.length > 0
          ? `Revenge & Emotional Trading Detected (${emotional.length} Trade(s))`
          : `Emotional Trading Pattern (${emotional.length} Trade(s))`,
      whatYouDid: `Took trades while feeling ${Array.from(new Set(emotional.map((t) => t.emotion))).join(", ")}.`,
      whatWasIncorrect: "Letting recent wins or losses dictate your next click degrades entry quality and risk control.",
      whyProblematic: "Revenge trades after a loss typically double position size at poor entries, turning normal days into wipeouts.",
      whatYouShouldHaveDone: "Pause for 15 minutes after any loss and complete a quick self-check in the Psychology Lab.",
      howToAvoidRepeating: [
        "Enforce a hard rule: stop trading for the day after 2–3 consecutive losses.",
        "Accept missed moves calmly—another valid setup always arrives.",
      ],
      practicalExample: "After hitting a ₹5,000 stop-loss on BANKNIFTY, close the chart for 15 minutes instead of immediately reversing.",
      recommendedLesson: "Course 23: Trading Psychology",
      practiceExercise: "Log a daily self-awareness reflection in the Trading Psychology Lab for 5 days.",
      affectedTrades: emotional.length,
      isRepeated: emotional.length >= 2,
    });
  }

  // 6. Poor Risk/Reward & Premature Profit Booking
  const prematureProfit = journal.filter(
    (t) =>
      t.netPnl > 0 &&
      t.plannedTarget !== undefined &&
      t.exitReason === "MANUAL" &&
      Math.abs(t.exitPrice - t.entryPrice) < Math.abs(t.plannedTarget - t.entryPrice) * 0.55
  );
  if (prematureProfit.length > 0 || (total >= 3 && stats.avgLoss > 0 && stats.avgWin < stats.avgLoss)) {
    mistakes.push({
      id: "m_poor_rr_exit",
      severity: "WARNING",
      category: "Exit & Risk/Reward",
      title:
        prematureProfit.length > 0
          ? `Premature Profit Booking & Poor R:R (${prematureProfit.length} Trade(s))`
          : "Poor Risk/Reward: Average Loss Exceeds Average Win",
      whatYouDid:
        prematureProfit.length > 0
          ? `Closed winning trades early before reaching 55% of your planned target.`
          : `Average Win (₹${stats.avgWin.toFixed(0)}) is smaller than Average Loss (₹${stats.avgLoss.toFixed(0)}).`,
      whatWasIncorrect: "Fear of giving back small green P&L cuts winners short while losses hit full stop-loss.",
      whyProblematic: "Asymmetric small wins + full losses create negative expectancy even with a 55% win rate.",
      whatYouShouldHaveDone: "Let winners run to your predefined 1:1.5+ target or trail stop-loss logically below swing lows.",
      howToAvoidRepeating: [
        "Set your Target order at entry and avoid watching every 1-second P&L tick.",
        "Track your realized R-multiple in Journal & Analytics.",
      ],
      practicalExample: "If risking ₹35 for a ₹70 target (1:2 R:R), don't panic-exit at +₹15 unless structure actually breaks.",
      recommendedLesson: "Course 22: Risk/Reward Ratio",
      practiceExercise: "Complete 5 Bracket orders without manually closing early.",
      affectedTrades: Math.max(prematureProfit.length, 1),
      isRepeated: prematureProfit.length >= 2,
    });
  }

  // 7. Overtrading Detection (many trades on same day)
  const dayCounts = new Map<string, number>();
  for (const t of journal) {
    const day = t.closedAt.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const maxTradesInDay = Math.max(0, ...Array.from(dayCounts.values()));
  if (maxTradesInDay >= 8) {
    mistakes.push({
      id: "m_overtrading",
      severity: "WARNING",
      category: "Overtrading",
      title: `Overtrading Pattern (${maxTradesInDay} Trades in a Single Day)`,
      whatYouDid: `Executed ${maxTradesInDay} closed trades within one session.`,
      whatWasIncorrect: "High trade frequency lowers setup selectivity and multiplies Indian STT, GST, and slippage drag.",
      whyProblematic: "SEBI data shows transaction costs consume 15%–50% of profits for active retail traders.",
      whatYouShouldHaveDone: "Focus on 2–4 A+ high-conviction setups per session rather than trading market noise.",
      howToAvoidRepeating: [
        "Set a personal cap of max 4–5 trades per day.",
        "Check your Day-Wise Charges report every evening.",
      ],
      practicalExample: "Taking 3 clean 1:2 R:R setups beats taking 12 low-probability scalps.",
      recommendedLesson: "Course 19: Risk Management & Course 28: Trading Journaling",
      practiceExercise: "Join the 'No Overtrading Challenge' in the Challenges & Achievements tab.",
      affectedTrades: maxTradesInDay,
      isRepeated: maxTradesInDay >= 10,
    });
  }

  // 8. Inconsistent Strategy / Single-Regime Overconfidence
  if (total >= 5 && stats.regimesTested.length < 2) {
    mistakes.push({
      id: "m_single_regime",
      severity: "COACHING",
      category: "Consistency & Regime Testing",
      title: "Unverified Consistency Across Market Conditions",
      whatYouDid: `All ${total} closed trades occurred in only 1 market regime (${stats.regimesTested[0] ?? "BULL"}).`,
      whatWasIncorrect: "Assuming bull-market results will hold in sideways or falling markets leads to live overconfidence.",
      whyProblematic: "Breakout strategies that thrive in trends often suffer consecutive whipsaws in choppy consolidation.",
      whatYouShouldHaveDone: "Test your system across Bull, Sideways, Correction, and Volatility Spike modes.",
      howToAvoidRepeating: [
        "Switch Market Regime in the Pro Terminal and log at least 10 trades per regime.",
        "Compare regime results in Performance Analytics.",
      ],
      practicalExample: "Verify whether your EMA Crossover holds positive expectancy during 'Sideways Consolidation'.",
      recommendedLesson: "Course 24: Market Structure & Course 27: Backtesting",
      practiceExercise: "Complete 3 simulated trades in 'Sideways Consolidation' or 'Sharp Correction' mode.",
      affectedTrades: total,
      isRepeated: false,
    });
  }

  // Compute 6 Skill Pillars
  const slScore =
    total === 0 ? 65 : Math.max(15, Math.round(100 - (missingSl.length / total) * 55 - (brokenSl.length / total) * 45));
  const sizingScore =
    total === 0 ? 68 : Math.max(20, Math.round(100 - (oversized.length / total) * 60 - Math.max(0, stats.maxDrawdownPercent - 5) * 3));
  const rrScore =
    total === 0
      ? 62
      : Math.min(100, Math.max(15, Math.round(52 + (stats.expectancyPerTrade > 0 ? 28 : -18) + (stats.avgLoss > 0 ? Math.min(20, (stats.avgWin / stats.avgLoss) * 10) : 10))));
  const emotionScore =
    total === 0 ? 72 : Math.max(20, Math.round(100 - (emotional.length / total) * 65 - (revenge.length / total) * 20));
  const missingRefl = journal.filter((t) => !t.reflection.trim()).length;
  const journalScore =
    total === 0 ? 60 : Math.max(25, Math.round(100 - (missingRefl / total) * 40 - (noStrategy.length / total) * 35));
  const costRatio = stats.grossPnl > 0 ? (stats.totalCharges / stats.grossPnl) * 100 : total > 0 ? 35 : 0;
  const costScore = total === 0 ? 72 : Math.max(25, Math.min(100, Math.round(100 - Math.min(75, costRatio * 1.1))));

  const pillars: SkillPillar[] = [
    { key: "sl", label: "Stop-Loss Discipline", score: slScore, status: scoreToStatus(slScore), teacherNote: `${missingSl.length} missing SL, ${brokenSl.length} violated SL.` },
    { key: "sizing", label: "Position Sizing & Exposure", score: sizingScore, status: scoreToStatus(sizingScore), teacherNote: `Max Drawdown ${stats.maxDrawdownPercent.toFixed(1)}% (limit ${account.riskLimits.maxDrawdownPct}%).` },
    { key: "rr", label: "Entry, Exit & Risk/Reward", score: rrScore, status: scoreToStatus(rrScore), teacherNote: `Expectancy ${formatINR(stats.expectancyPerTrade)}/trade.` },
    { key: "emotion", label: "Emotional & Impulse Control", score: emotionScore, status: scoreToStatus(emotionScore), teacherNote: `${emotional.length} emotional trade(s) flagged.` },
    { key: "journal", label: "Strategy & Journaling", score: journalScore, status: scoreToStatus(journalScore), teacherNote: `${total - missingRefl}/${total} trades have reflections.` },
    { key: "cost", label: "Overtrading & Cost Efficiency", score: costScore, status: scoreToStatus(costScore), teacherNote: `Max ${plural(maxTradesInDay, "trade")}/day · Charges ${formatINR(stats.totalCharges)}.` },
  ];

  const isUnrated = total === 0;
  const rawOverall = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);
  const overallScore = isUnrated ? 0 : rawOverall;
  const disciplineScore = isUnrated ? 0 : Math.round((slScore + sizingScore + emotionScore + journalScore) / 4);
  const academyBonus = Math.min(20, account.completedCourseIds.length);
  const improvementScore = isUnrated ? 0 : Math.min(100, Math.round(disciplineScore * 0.8 + academyBonus));
  const grade: TeacherReport["grade"] = isUnrated ? "Unrated" : scoreToGrade(rawOverall);

  const weaknessProfile = [...pillars]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((p) => `${p.label} (${p.score}/100)`);

  const repeatedMistakeAlerts = mistakes
    .filter((m) => m.isRepeated)
    .map((m) => `Repeated Alert: ${m.title} (${m.affectedTrades} occurrences)`);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayTrades = journal.filter((t) => t.closedAt.startsWith(todayIso));
  const todayNet = todayTrades.reduce((s, t) => s + t.netPnl, 0);

  const dailyFeedback =
    todayTrades.length === 0
      ? "No closed trades today yet. Focus on completing 1 Academy lesson and planning 1–2 high-conviction Bracket orders."
      : `Today: ${plural(todayTrades.length, "trade")}, Net ${formatINR(todayNet, { signed: true })}. ${todayTrades.every((t) => t.plannedStopLoss) ? "Excellent stop-loss discipline today!" : "Reminder: never skip setting a stop-loss before entry."}`;

  const weeklyReview =
    total === 0
      ? "Build your first 5–10 simulated trades this week so your AI Teacher can compute your weekly edge and discipline trend."
      : `Across ${plural(total, "recorded trade")}, Discipline Score is ${disciplineScore}/100 with ${stats.winRate.toFixed(1)}% win rate and ${formatINR(stats.expectancyPerTrade, { decimals: 0 })} expectancy/trade.`;

  const monthlyReport = `Monthly Readiness: ${stats.readinessScore}% Go-Live score · ${account.completedCourseIds.length}/28 Academy courses completed · ${account.resetCount} account refill(s) recorded with full history preserved.`;

  const headline =
    total === 0
      ? "Welcome to TradeGuru AI! Place your first guided simulated trade or start Course 1 in the Academy—your AI Teacher will grade your process, not just your luck."
      : overallScore >= 85
        ? "Strong institutional-grade discipline! Keep scaling your sample across multiple regimes toward 50–100 trades."
        : overallScore >= 65
          ? "Solid progress with specific fixable mistakes below. Focus on your top weakness pillar this week."
          : "Key risk habits need attention—thankfully every mistake here costs ₹0! Follow your Teacher's 8-point fixes below.";

  const homework = [
    `Weakest Pillar Drill: Work on ${weaknessProfile[0]} over your next 5 simulated trades.`,
    "Complete 2 courses in the 28-Course Trading Academy (English or Hindi) and pass their chapter quizzes.",
    "Run 1 historical Backtest with Indian costs + slippage in the Strategy Lab before trading that setup live-sim.",
    "Write a 1-sentence post-trade reflection on every closed trade and download your Monthly PDF Report Card.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    disciplineScore,
    improvementScore,
    goodProcessLosses,
    grade,
    headline,
    weaknessProfile,
    repeatedMistakeAlerts,
    dailyFeedback,
    weeklyReview,
    monthlyReport,
    pillars,
    mistakes,
    strengths,
    homework,
  };
}

export const CLASSROOM_LESSONS: ClassroomLevel[] = [
  {
    level: 0,
    title: "Level 0: Market Foundations & Virtual ₹10L Setup",
    subtitle: "Start from zero — understand exchanges, bid/ask, and risk-free simulation",
    teacherExplanation: "TradeGuru AI gives you ₹10,00,000 virtual capital with automatic refill and permanent history so you can learn like a pilot in a flight simulator.",
    keyRules: ["Complete Courses 1–3 in the 28-Course Trading Academy.", "Inspect the 10-Level Market Depth in Pro Terminal."],
    missionLabel: "Complete at least 1 Academy course or place your first trade",
    targetView: "Academy",
    checkCompleted: (acc) => acc.completedCourseIds.length >= 1 || acc.orders.length >= 1,
  },
  {
    level: 1,
    title: "Level 1: Safe Order Execution & Stop-Loss Shield",
    subtitle: "Master Market, Limit, SL, SL-M, Bracket & 1% position sizing",
    teacherExplanation: "Before thinking about profits, lock in your Stop-Loss and size your quantity to 1% risk.",
    keyRules: ["Always attach a Stop-Loss.", "Use 'Apply Teacher Fix' to see proper 1:2 R:R sizing."],
    missionLabel: "Place a simulated trade with a Stop-Loss in Pro Terminal",
    targetView: "Trade Terminal",
    checkCompleted: (acc) => acc.orders.some((o) => Boolean(o.stopLossPrice)),
  },
  {
    level: 2,
    title: "Level 2: Risk Center, Backtesting & Journaling",
    subtitle: "Validate rules historically and track expectancy net of Indian taxes",
    teacherExplanation: "Combine Strategy Backtesting (with slippage & STT) and automatic Trade Journaling so every trade makes you sharper.",
    keyRules: ["Test a strategy in Backtesting Lab.", "Write a post-trade reflection in your Trading Journal."],
    missionLabel: "Close 1 trade and record a post-trade reflection",
    targetView: "Journal & Analytics",
    checkCompleted: (acc) => acc.journal.some((t) => t.reflection.trim().length > 0),
  },
  {
    level: 3,
    title: "Level 3: Psychology Mastery & Multi-Regime Stress Test",
    subtitle: "Build emotional discipline across Bull, Sideways, Correction & Volatility",
    teacherExplanation: "Log pre-trade and post-trade emotions, pass the Psychology self-check, and stress-test across multiple market regimes.",
    keyRules: ["Log at least 1 entry in the Trading Psychology Lab.", "Test trades in 2+ market regimes."],
    missionLabel: "Log a Psychology self-check or test 2+ market regimes",
    targetView: "Psychology & Challenges",
    checkCompleted: (acc) => acc.psychologyLogs.length >= 1 || new Set(acc.journal.map((t) => t.regime)).size >= 2,
  },
];

export const TEACHER_QUIZ: TeacherQuizQuestion[] = [
  {
    id: "q1",
    question: "With ₹10,00,000 virtual capital and a 1% risk rule (₹10,000 max loss), if Entry is ₹2,200 and Stop-Loss is ₹2,150 (₹50 risk/share), what is the disciplined quantity?",
    options: ["100 shares", "200 shares", "500 shares", "1,000 shares"],
    correctIndex: 1,
    explanation: "1% of ₹10,00,000 = ₹10,000. Dividing ₹10,000 by the ₹50 stop-loss distance equals exactly 200 shares.",
  },
  {
    id: "q2",
    question: "You follow your exact strategy, size to 1% risk, and exit cleanly when your Stop-Loss hits for a −1% loss. How should the AI Teacher grade this trade?",
    options: [
      "Bad trade because it lost money",
      "Good Process Loss — disciplined risk execution in a probabilistic market",
      "You should have removed the stop-loss and doubled down",
      "Delete it from your journal",
    ],
    correctIndex: 1,
    explanation: "Never judge trade quality solely by single-trade P&L. Following your strategy and stop-loss makes it a Good Process trade.",
  },
  {
    id: "q3",
    question: "Why must historical backtests include spread, slippage, and Indian STT/GST/stamp duty?",
    options: [
      "Without costs and slippage, high-frequency strategies look artificially profitable and fail live",
      "Only to make charts slower",
      "Because paper trading has brokerage",
      "It makes no difference",
    ],
    correctIndex: 0,
    explanation: "Transaction costs and slippage can turn a marginally positive gross strategy into a net loser in real NSE/F&O markets.",
  },
  {
    id: "q4",
    question: "What happens in TradeGuru AI when your virtual account is refilled after depletion?",
    options: [
      "All past trades and reports are permanently wiped",
      "Open positions/pending orders are safely resolved, ₹10,00,000 is added, and ALL past trades, reports & AI Teacher feedback are preserved",
      "Your account is suspended",
      "You must pay a subscription fee",
    ],
    correctIndex: 1,
    explanation: "TradeGuru AI is 100% free and never overwrites or deletes historical financial records—every refill is logged cleanly in Refill History.",
  },
];

function scoreToStatus(score: number): SkillPillar["status"] {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs Focus";
}

function scoreToGrade(score: number): TeacherReport["grade"] {
  if (score >= 92) return "A+";
  if (score >= 82) return "A";
  if (score >= 74) return "B+";
  if (score >= 65) return "B";
  if (score >= 52) return "C";
  return "D";
}
