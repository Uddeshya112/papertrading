"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { WorkspaceErrorBoundary } from "@/components/workspace-error-boundary";
import type { User } from "@supabase/supabase-js";
import { authRedirect, clearSupabaseConfig, getSavedSupabaseConfig, getSupabase, isSupabaseConfigured, saveSupabaseConfig } from "@/lib/supabase";
import { flushPendingSyncIfDue, pullAccountFromCloud, pushAccountToCloud, type CloudSyncStatus } from "@/lib/cloud-sync";
import { TradingViewWidget } from "@/components/tradingview-widget";
import { NavIcon } from "@/components/nav-icons";
import { formatINR, plural } from "@/lib/format";
const ProTerminalView = dynamic(() => import("@/components/pro-terminal-view").then(m => m.ProTerminalView), { loading: () => <ViewSkeleton /> });
const PortfolioView = dynamic(() => import("@/components/portfolio-view").then(m => m.PortfolioView), { loading: () => <ViewSkeleton /> });
const JournalAnalyticsView = dynamic(() => import("@/components/journal-analytics-view").then(m => m.JournalAnalyticsView), { loading: () => <ViewSkeleton /> });
const AlertsWatchlistView = dynamic(() => import("@/components/alerts-watchlist-view").then(m => m.AlertsWatchlistView), { loading: () => <ViewSkeleton /> });
const OptionsChainView = dynamic(() => import("@/components/options-chain-view").then(m => m.OptionsChainView), { loading: () => <ViewSkeleton /> });
import {
  BasketOrdersView,
  type BasketLegDraft,
  type ExecutedIsoBasket,
} from "@/components/basket-orders-view";
const ScreenerView = dynamic(() => import("@/components/screener-view").then(m => m.ScreenerView), { loading: () => <ViewSkeleton /> });
const TeacherCoachView = dynamic(() => import("@/components/teacher-coach-view").then(m => m.TeacherCoachView), { loading: () => <ViewSkeleton /> });
const AcademyView = dynamic(() => import("@/components/academy-view").then(m => m.AcademyView), { loading: () => <ViewSkeleton /> });
const RiskCenterView = dynamic(() => import("@/components/risk-center-view").then(m => m.RiskCenterView), { loading: () => <ViewSkeleton /> });
const BacktestLabView = dynamic(() => import("@/components/backtest-lab-view").then(m => m.BacktestLabView), { loading: () => <ViewSkeleton /> });
const PsychologyChallengesView = dynamic(() => import("@/components/psychology-challenges-view").then(m => m.PsychologyChallengesView), { loading: () => <ViewSkeleton /> });
const ReportsCenterView = dynamic(() => import("@/components/reports-center-view").then(m => m.ReportsCenterView), { loading: () => <ViewSkeleton /> });
const MarketIntelAdminView = dynamic(() => import("@/components/market-intel-admin-view").then(m => m.MarketIntelAdminView), { loading: () => <ViewSkeleton /> });
import {
  buildRohitExampleJournal,
  closePaperPosition,
  computePositionPnl,
  createDefaultPaperState,
  DEFAULT_VIRTUAL_CAPITAL,
  loadPaperState,
  performSafeAccountRefill,
  placePaperOrder,
  processMarketTickOnAccount,
  pushNotification,
  savePaperState,
  type PaperAccountState,
  type PlaceOrderInput,
  type PsychologyLog,
  type RiskLimitsConfig,
} from "@/lib/paper-engine";
import {
  createInitialQuotes,
  PAPER_INSTRUMENTS,
  stepMarketQuotes,
  type LiveQuote,
  type MarketRegime,
} from "@/lib/paper-instruments";
import { computeAnalytics } from "@/lib/analytics";
import { diagnoseTradingReport } from "@/lib/teacher-coach";
import type { BrokeragePlan } from "@/lib/indian-charges";

const ViewSkeleton = () => (
  <section className="surface-card" aria-busy="true">
    <span className="card-kicker">LOADING MODULE</span>
    <p className="market-api-muted">Preparing TradeGuru AI workspace view…</p>
  </section>
);

type View =
  | "Overview"
  | "Trade Terminal"
  | "AI Teacher"
  | "Academy"
  | "Options Chain"
  | "Basket Orders"
  | "Screener"
  | "Risk Center"
  | "Backtesting Lab"
  | "Portfolio"
  | "Journal & Analytics"
  | "Psychology & Challenges"
  | "Reports Center"
  | "Market Intel & Admin"
  | "Watchlist & Alerts"
  | "Profile"
  | "Settings";

type Profile = { fullName: string; phone: string; country: string };
const emptyProfile: Profile = { fullName: "", phone: "", country: "" };

const views: View[] = [
  "Overview",
  "Trade Terminal",
  "AI Teacher",
  "Academy",
  "Options Chain",
  "Basket Orders",
  "Screener",
  "Risk Center",
  "Backtesting Lab",
  "Portfolio",
  "Journal & Analytics",
  "Psychology & Challenges",
  "Reports Center",
  "Market Intel & Admin",
  "Watchlist & Alerts",
  "Profile",
  "Settings",
];

const VIEW_SLUGS: Record<View, string> = {
  Overview: "overview",
  "Trade Terminal": "terminal",
  "AI Teacher": "ai-teacher",
  Academy: "academy",
  "Options Chain": "options",
  "Basket Orders": "baskets",
  Screener: "screener",
  "Risk Center": "risk",
  "Backtesting Lab": "backtest",
  Portfolio: "portfolio",
  "Journal & Analytics": "journal",
  "Psychology & Challenges": "psychology",
  "Reports Center": "reports",
  "Market Intel & Admin": "admin",
  "Watchlist & Alerts": "watchlist",
  Profile: "profile",
  Settings: "settings",
};

const SLUG_TO_VIEW: Record<string, View> = Object.fromEntries(
  (Object.entries(VIEW_SLUGS) as [View, string][]).map(([v, slug]) => [slug, v])
) as Record<string, View>;

const descriptions: Record<View, string> = {
  Overview: "100% Free TradeGuru AI — ₹10,00,000 virtual capital, AI Teacher coaching, and live market observation.",
  "Trade Terminal": "Pro candlestick charts (10 timeframes), indicators, drawing tools, 10-level depth, partial fills & AI Teacher guardrails.",
  "AI Teacher": "16-mistake 8-point educational diagnosis, weakness profile, daily/weekly/monthly reviews & guided classroom.",
  Academy: "28 structured courses in English & Hindi — zero to advanced with chapter quizzes and progress tracking.",
  "Options Chain": "Calls & Puts with OI, Volume, IV, Bid/Ask, ITM highlights, and Full + Nearby PCR.",
  "Basket Orders": "Multi-leg stock, futures & hedged options baskets in ISO or COMB mode with pre-built strategies.",
  Screener: "Top gainers, losers, high-volume leaders, and sector performance rollup.",
  "Risk Center": "Position sizing, Risk of Ruin simulator, personal risk limits, sector exposure & capital protection score.",
  "Backtesting Lab": "No-look-ahead historical backtesting with Indian costs/slippage, chart replay, walk-forward & Monte Carlo.",
  Portfolio: "Total equity, buying power, holdings vs intraday positions, safe ₹10L auto/manual refill & immutable history.",
  "Journal & Analytics": "Automatic trading journal, day-wise P&L, expectancy, drawdown, equity curve & Go-Live readiness.",
  "Psychology & Challenges": "Self-awareness mindset lab (fear/greed/patience) + 10 discipline-first challenges, XP & printable certificate.",
  "Reports Center": "Download all 12 reports or the complete full-account bundle in PDF, CSV, or Excel format.",
  "Market Intel & Admin": "NIFTY 50, BANK NIFTY, SENSEX, breadth, macro calendar, news & immutable admin audit console.",
  "Watchlist & Alerts": "Personal saved watchlist and live price alerts.",
  Profile: "View and update your Supabase account profile.",
  Settings: "Configure order confirmation, auto-refill threshold, brokerage plan, slippage & notification preferences.",
};

function profileFromUser(user: User | null | undefined): Profile {
  const metadata = user?.user_metadata ?? {};
  return {
    fullName: typeof metadata.full_name === "string" ? metadata.full_name : "",
    phone: typeof metadata.phone === "string" ? metadata.phone : "",
    country: typeof metadata.country === "string" ? metadata.country : "",
  };
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("Overview");
  const [notice, setNotice] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>("LOCAL_ONLY");
  const [liveFeedSource, setLiveFeedSource] = useState("Simulated Ticks");
  const [supaUrlInput, setSupaUrlInput] = useState("");
  const [supaKeyInput, setSupaKeyInput] = useState("");
  const [supaConnected, setSupaConnected] = useState(false);
  const [hasSavedSupaKeys, setHasSavedSupaKeys] = useState(false);
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [profileNoticeIsError, setProfileNoticeIsError] = useState(false);

  // TradeGuru AI account & market state (Default ₹10,00,000)
  const [account, setAccount] = useState<PaperAccountState>(() =>
    createDefaultPaperState(DEFAULT_VIRTUAL_CAPITAL)
  );
  const [hydrated, setHydrated] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>(() => createInitialQuotes());
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(PAPER_INSTRUMENTS[0].id);
  const [regime, setRegime] = useState<MarketRegime>("BULL");
  const [simRunning, setSimRunning] = useState(true);
  const [teacherMode, setTeacherMode] = useState(true);
  const [stagedBasketLegs, setStagedBasketLegs] = useState<BasketLegDraft[]>([]);
  const [isoBaskets, setIsoBaskets] = useState<ExecutedIsoBasket[]>([]);

  // Sync activeView with ?view=<slug> URL parameter and browser Back/Forward buttons
  function navigateView(nextView: View) {
    setActiveView(nextView);
    if (typeof window !== "undefined") {
      const slug = VIEW_SLUGS[nextView];
      const nextUrl = slug === "overview" ? window.location.pathname : `${window.location.pathname}?view=${slug}`;
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState({ view: nextView }, "", nextUrl);
      }
    }
  }

  useEffect(() => {
    const readViewFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("view");
      if (slug && SLUG_TO_VIEW[slug]) {
        setActiveView(SLUG_TO_VIEW[slug]);
      } else {
        setActiveView("Overview");
      }
    };
    readViewFromUrl();
    window.addEventListener("popstate", readViewFromUrl);
    return () => window.removeEventListener("popstate", readViewFromUrl);
  }, []);

  // Auto-dismiss status toasts after 4 seconds
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const saved = getSavedSupabaseConfig();
    if (saved) {
      setSupaUrlInput(saved.url);
      setSupaKeyInput(saved.publishableKey);
      setHasSavedSupaKeys(true);
    } else {
      setHasSavedSupaKeys(false);
    }
    setSupaConnected(isSupabaseConfigured());
  }, []);

  useEffect(() => {
    const loaded = loadPaperState(signedIn ? accountEmail : undefined);
    setAccount(loaded);
    setHydrated(true);
  }, [signedIn, accountEmail]);

  useEffect(() => {
    if (!signedIn || !authUserId) {
      setCloudStatus("LOCAL_ONLY");
      return;
    }
    let cancelled = false;
    setCloudStatus("SYNCING");
    void pullAccountFromCloud(authUserId).then((cloudState) => {
      if (cancelled) return;
      if (cloudState) {
        setAccount(cloudState);
        setCloudStatus("SYNCED");
      } else {
        setCloudStatus("OFFLINE_FALLBACK");
      }
    });
    return () => { cancelled = true; };
  }, [signedIn, authUserId]);

  useEffect(() => {
    if (!hydrated) return;
    savePaperState(account, signedIn ? accountEmail : undefined);
    if (!signedIn || !authUserId) return;
    const timer = window.setTimeout(() => {
      void pushAccountToCloud(authUserId, account).then((status) => setCloudStatus(status));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [account, hydrated, signedIn, accountEmail, authUserId]);

  // Periodically anchor quotes to real-world delayed NSE/BSE public feed (/api/market/quotes)
  useEffect(() => {
    let active = true;
    async function syncPublicQuotes() {
      try {
        const res = await fetch("/api/market/quotes", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          ok?: boolean;
          source?: string;
          quotes?: Record<string, { last: number; prevClose: number; change: number; changePercent: number; asOf: string }>;
        };
        if (!active || !payload.ok || !payload.quotes) return;
        const incoming = payload.quotes;
        setQuotes((prev) => {
          const merged = { ...prev };
          for (const [id, q] of Object.entries(incoming)) {
            if (!merged[id]) continue;
            merged[id] = {
              ...merged[id],
              last: q.last,
              prevClose: q.prevClose,
              change: q.change,
              changePercent: q.changePercent,
              high: Math.max(merged[id].high, q.last),
              low: Math.min(merged[id].low, q.last),
              bid: Number((q.last * 0.9998).toFixed(2)),
              ask: Number((q.last * 1.0002).toFixed(2)),
              history: [...merged[id].history.slice(-47), q.last],
              updatedAt: q.asOf,
            };
          }
          return merged;
        });
        setLiveFeedSource("Real Delayed Feed (NSE/BSE)");
      } catch {
        /* Stay gracefully on simulated feed when offline */
      }
    }
    void syncPublicQuotes();
    const interval = window.setInterval(() => void syncPublicQuotes(), 25000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  // Live tick loop (1.8s)
  useEffect(() => {
    const onOnline = () => {
      void flushPendingSyncIfDue().then((status) => {
        if (status) setCloudStatus(status);
      });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (!simRunning) return;
    const timer = window.setInterval(() => {
      setQuotes((prevQuotes) => {
        const nextQuotes = stepMarketQuotes(prevQuotes, regime);
        setAccount((prevAcc) => {
          const { state: updated, notifications } = processMarketTickOnAccount(prevAcc, nextQuotes);
          if (notifications.length > 0) setNotice(notifications[0]);
          return updated;
        });

        setIsoBaskets((prevBaskets) => {
          if (prevBaskets.length === 0) return prevBaskets;
          const remaining: ExecutedIsoBasket[] = [];
          for (const b of prevBaskets) {
            const livePnl = b.legs.reduce((sum, leg) => {
              const ltp = nextQuotes[leg.instrumentId]?.last ?? leg.price;
              const diff = leg.side === "BUY" ? ltp - leg.price : leg.price - ltp;
              return sum + diff * leg.lots * leg.lotSize;
            }, 0);
            if (b.basketTarget > 0 && livePnl >= b.basketTarget) {
              setAccount((acc) => ({
                ...acc,
                availableCash: Number((acc.availableCash + b.marginBlocked + livePnl).toFixed(2)),
              }));
              setNotice(`ISO Basket target hit: ${b.name} (${formatINR(livePnl, { signed: true })})`);
            } else if (b.basketStopLoss > 0 && livePnl <= -b.basketStopLoss) {
              setAccount((acc) => ({
                ...acc,
                availableCash: Number((acc.availableCash + b.marginBlocked + livePnl).toFixed(2)),
              }));
              setNotice(`ISO Basket SL hit: ${b.name} (${formatINR(livePnl, { signed: true })})`);
            } else {
              remaining.push(b);
            }
          }
          return remaining;
        });
        return nextQuotes;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [simRunning, regime]);

  // Supabase Auth
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const supabase = getSupabase();
      void supabase.auth.getSession().then(({ data }) => {
        const user = data.session?.user;
        const confirmed = Boolean(user?.email_confirmed_at);
        const nextProfile = confirmed ? profileFromUser(user) : emptyProfile;
        setSignedIn(confirmed);
        setAccountEmail(user?.email ?? "");
        setAuthUserId(confirmed && user?.id ? user.id : "");
        setProfile(nextProfile);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        const confirmed = Boolean(user?.email_confirmed_at);
        const nextProfile = confirmed ? profileFromUser(user) : emptyProfile;
        setSignedIn(confirmed);
        setAccountEmail(user?.email ?? "");
        setAuthUserId(confirmed && user?.id ? user.id : "");
        setProfile(nextProfile);
        if (!confirmed) setProfileSetupOpen(false);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    } catch {
      /* Works 100% locally even without Supabase env vars */
    }
    return unsubscribe;
  }, []);

  const isoMargin = useMemo(() => isoBaskets.reduce((s, b) => s + b.marginBlocked, 0), [isoBaskets]);
  const isoUnrealized = useMemo(
    () =>
      isoBaskets.reduce((s, b) => {
        const pnl = b.legs.reduce((ls, leg) => {
          const ltp = quotes[leg.instrumentId]?.last ?? leg.price;
          const diff = leg.side === "BUY" ? ltp - leg.price : leg.price - ltp;
          return ls + diff * leg.lots * leg.lotSize;
        }, 0);
        return s + pnl;
      }, 0),
    [isoBaskets, quotes]
  );

  const usedMargin = useMemo(
    () => account.positions.reduce((s, p) => s + p.marginBlocked, 0) + isoMargin,
    [account.positions, isoMargin]
  );
  const unrealizedPnl = useMemo(
    () =>
      account.positions.reduce((s, p) => {
        const ltp = quotes[p.instrumentId]?.last ?? p.entryPrice;
        return s + computePositionPnl(p, ltp);
      }, 0) + isoUnrealized,
    [account.positions, quotes, isoUnrealized]
  );
  const netEquity = account.availableCash + usedMargin + unrealizedPnl;
  const analytics = useMemo(() => computeAnalytics(account), [account]);
  const teacherReport = useMemo(() => diagnoseTradingReport(account), [account]);
  const unreadNotifs = account.notifications.filter((n) => !n.read).length;
  const studentName = profile.fullName.trim() || (accountEmail ? accountEmail.split("@")[0] : "Student Trader");

  // Handlers
  function handlePlaceOrder(input: PlaceOrderInput) {
    const q = quotes[input.instrumentId];
    if (!q) return;
    const result = placePaperOrder(account, input, q);
    setAccount(result.state);
    setNotice(result.message);
  }

  function handleClosePosition(positionId: string, exitPrice: number) {
    const res = closePaperPosition(account, positionId, exitPrice, "MANUAL");
    setAccount(res.state);
    if (res.trade) {
      setNotice(`Closed ${res.trade.symbol} @ ${formatINR(exitPrice)} · Net ${formatINR(res.trade.netPnl, { signed: true })}`);
    }
  }

  function handleCancelOrder(orderId: string) {
    setAccount((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o)),
    }));
    setNotice("Order cancelled.");
  }

  function handleModifyPendingOrder(orderId: string, newPrice: number) {
    setAccount((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => {
        if (o.id !== orderId) return o;
        if (o.orderType === "LIMIT" || o.orderType === "AUTO-LIMIT") return { ...o, limitPrice: newPrice };
        return { ...o, triggerPrice: newPrice, limitPrice: o.orderType === "SL" ? newPrice : o.limitPrice };
      }),
    }));
    setNotice(`Modified order price to ₹${newPrice}.`);
  }

  function handleManualRefill(reason: string) {
    setAccount((prev) =>
      performSafeAccountRefill(prev, quotes, {
        mode: "MANUAL",
        reason,
        addAmount: DEFAULT_VIRTUAL_CAPITAL,
      })
    );
    setNotice("Refilled +₹10,00,000 safely. All historical trades & AI Teacher records preserved!");
  }

  function handleSwitchChallenge(challengeId: string, capital: number, name: string) {
    setAccount((prev) =>
      performSafeAccountRefill(prev, quotes, {
        mode: "CHALLENGE_SWITCH",
        reason: `Switched account challenge to ${name} (₹${capital.toLocaleString("en-IN")}).`,
        addAmount: capital,
        challengeId,
      })
    );
    setNotice(`Switched to ${name}. All past history preserved!`);
  }

  function handleCompleteCourse(courseId: string, quizScore: number) {
    setAccount((prev) => {
      if (prev.completedCourseIds.includes(courseId)) return prev;
      return pushNotification(
        {
          ...prev,
          completedCourseIds: [...prev.completedCourseIds, courseId],
          quizScores: { ...prev.quizScores, [courseId]: quizScore },
        },
        {
          category: "ACADEMY",
          title: "Academy Course Mastered!",
          message: `Completed course ${courseId.toUpperCase()} with ${quizScore}% quiz score (+40 XP).`,
        }
      );
    });
  }

  function handleUpdateRiskLimits(limits: RiskLimitsConfig) {
    setAccount((prev) => ({ ...prev, riskLimits: limits }));
    setNotice("Personal risk limits updated.");
  }

  function handleAddPsychologyLog(log: Omit<PsychologyLog, "id" | "date">) {
    setAccount((prev) => ({
      ...prev,
      psychologyLogs: [
        { ...log, id: `PSY-${Date.now().toString(36).toUpperCase()}`, date: new Date().toISOString() },
        ...prev.psychologyLogs,
      ],
    }));
    setNotice("Psychology self-check logged (+30 XP).");
  }

  function handleAdminUpdateConfig(patch: {
    defaultVirtualCapital?: number;
    autoRefillThreshold?: number;
    announcement?: string;
  }) {
    setAccount((prev) => ({
      ...prev,
      autoRefillThreshold: patch.autoRefillThreshold ?? prev.autoRefillThreshold,
      adminConfig: {
        ...prev.adminConfig,
        defaultVirtualCapital: patch.defaultVirtualCapital ?? prev.adminConfig.defaultVirtualCapital,
        autoRefillThreshold: patch.autoRefillThreshold ?? prev.adminConfig.autoRefillThreshold,
        announcements: patch.announcement
          ? [patch.announcement, ...prev.adminConfig.announcements].slice(0, 5)
          : prev.adminConfig.announcements,
        auditLog: [
          {
            id: `AUD-${Date.now().toString(36).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            actor: studentName,
            action: "ADMIN_POLICY_UPDATE",
            details: `Updated default capital ₹${patch.defaultVirtualCapital ?? prev.adminConfig.defaultVirtualCapital}, refill threshold ₹${patch.autoRefillThreshold ?? prev.adminConfig.autoRefillThreshold}${patch.announcement ? `, broadcast: "${patch.announcement}"` : ""}.`,
          },
          ...prev.adminConfig.auditLog,
        ].slice(0, 150),
      },
    }));
    setNotice("Admin policy saved and recorded in immutable audit log.");
  }

  function handleExecuteBasket(params: {
    name: string;
    mode: "ISO" | "COMB";
    basketTarget: number;
    basketStopLoss: number;
    legs: BasketLegDraft[];
    hedgeBenefitApplied: boolean;
    netMargin: number;
  }) {
    if (params.legs.length === 0) return;
    if (params.netMargin > account.availableCash) {
      setNotice(`Insufficient cash for basket (need ₹${params.netMargin.toLocaleString("en-IN")}).`);
      return;
    }
    if (params.mode === "ISO") {
      const basket: ExecutedIsoBasket = {
        id: `BSK-${Date.now().toString(36).toUpperCase()}`,
        name: params.name,
        mode: "ISO",
        basketTarget: params.basketTarget,
        basketStopLoss: params.basketStopLoss,
        marginBlocked: params.netMargin,
        hedgeBenefitApplied: params.hedgeBenefitApplied,
        legs: params.legs,
        openedAt: new Date().toISOString(),
      };
      setAccount((prev) => ({ ...prev, availableCash: Number((prev.availableCash - params.netMargin).toFixed(2)) }));
      setIsoBaskets((prev) => [basket, ...prev]);
      setStagedBasketLegs([]);
      setNotice(`Executed ISO Basket "${params.name}" (${plural(params.legs.length, "leg")}).`);
      return;
    }
    let nextAcc = account;
    for (const leg of params.legs) {
      const q = quotes[leg.instrumentId];
      if (!q) continue;
      const res = placePaperOrder(
        nextAcc,
        {
          instrumentId: leg.instrumentId,
          side: leg.side,
          orderType: leg.orderType,
          product: leg.segment === "NSE_EQUITY" || leg.segment === "BSE_EQUITY" ? "INTRADAY" : "NRML",
          tif: "DAY",
          lots: leg.lots,
          limitPrice: leg.orderType === "LIMIT" ? leg.price : undefined,
          stopLossPrice: leg.stopLoss,
          targetPrice: leg.target,
          strategy: leg.segment === "NSE_OPTIONS" ? "Options Strategy" : "Swing Setup",
          emotion: "Disciplined",
          regime,
          rationale: `COMB Basket: ${params.name}`,
        },
        q
      );
      if (res.ok) nextAcc = res.state;
    }
    setAccount(nextAcc);
    setStagedBasketLegs([]);
    setNotice(`Executed COMB Basket "${params.name}".`);
  }

  function handleExitIsoBasket(basketId: string) {
    const b = isoBaskets.find((x) => x.id === basketId);
    if (!b) return;
    const livePnl = b.legs.reduce((sum, leg) => {
      const ltp = quotes[leg.instrumentId]?.last ?? leg.price;
      const diff = leg.side === "BUY" ? ltp - leg.price : leg.price - ltp;
      return sum + diff * leg.lots * leg.lotSize;
    }, 0);
    setAccount((prev) => ({ ...prev, availableCash: Number((prev.availableCash + b.marginBlocked + livePnl).toFixed(2)) }));
    setIsoBaskets((prev) => prev.filter((x) => x.id !== basketId));
    setNotice(`Exited ISO Basket "${b.name}" (${formatINR(livePnl, { signed: true })}).`);
  }

  // Auth handlers
  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const supabase = getSupabase();
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirect("/auth/reset-password") });
        if (error) throw error;
        setNotice("Password reset link sent if account exists.");
      } else if (registering) {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirect("/auth/callback") } });
        if (error) throw error;
        setNotice("Check your email for a confirmation link.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user?.email_confirmed_at) {
          await supabase.auth.signOut({ scope: "local" });
          setVerificationRequired(true);
          throw new Error("Confirm your email before signing in.");
        }
        setSignedIn(true);
        setAccountEmail(data.user.email ?? "");
        setProfile(profileFromUser(data.user));
        setAuthOpen(false);
        setNotice("Signed in to TradeGuru AI.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Auth error.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.resend({ type: "signup", email, options: { emailRedirectTo: authRedirect("/auth/callback") } });
      if (error) throw error;
      setNotice("Confirmation email resent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not resend email.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await getSupabase().auth.signOut();
    } finally {
      setSignedIn(false);
      setAccountEmail("");
      setAuthUserId("");
      setProfile(emptyProfile);
      setActiveView("Overview");
      setNotice("Signed out.");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.fullName.trim()) {
      setProfileNotice("Please enter your name.");
      setProfileNoticeIsError(true);
      return;
    }
    setProfileBusy(true);
    try {
      const { data, error } = await getSupabase().auth.updateUser({
        data: { full_name: profile.fullName.trim(), phone: profile.phone.trim(), country: profile.country.trim() },
      });
      if (error) throw error;
      setProfile(profileFromUser(data.user));
      setProfileSetupOpen(false);
      setProfileNotice("Profile saved.");
      setProfileNoticeIsError(false);
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "Could not save profile.");
      setProfileNoticeIsError(true);
    } finally {
      setProfileBusy(false);
    }
  }

  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" style={{ overflowY: "auto" }}>
        <button className="dashboard-brand" onClick={() => navigateView("Overview")} aria-label="TradeGuru AI">
          T<span>G</span>
        </button>
        <div className="sidebar-caption">TRADEGURU AI</div>
        <nav className="side-nav" aria-label="Main navigation">
          {views.map((view) => (
            <button
              key={view}
              className={`nav-item${activeView === view ? " selected" : ""}`}
              onClick={() => navigateView(view)}
              aria-current={activeView === view ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true"><NavIcon name={view} size={15} /></span>
              {view}
              {view === "AI Teacher" && teacherReport.mistakes.length > 0 && (
                <span className="nav-soon">{teacherReport.mistakes.length}</span>
              )}
              {view === "Basket Orders" && stagedBasketLegs.length > 0 && (
                <span className="nav-soon">{stagedBasketLegs.length}</span>
              )}
              {view === "Portfolio" && account.positions.length > 0 && (
                <span className="nav-soon">{account.positions.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="service-dot" /> Equity: <strong>₹{Math.round(netEquity).toLocaleString("en-IN")}</strong>
          <small>100% Free · Sim {simRunning ? "ON" : "Paused"}</small>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-topbar">
          <div className="mobile-brand">TradeGuru<span>AI</span></div>
          <div className="topbar-date">{today}</div>
          <div className="topbar-actions">
            <span className="nt-free-badge">100% FREE FOREVER</span>
            <span className="source-tag" title="Data source & cloud sync status">{liveFeedSource} · {cloudStatus === "SYNCED" ? "Cloud Synced ✓" : cloudStatus === "SYNCING" ? "Syncing…" : "Local Mode"}</span>
            <button type="button" className={`nt-pill${teacherMode ? " active" : ""}`} onClick={() => setTeacherMode((v) => !v)}>
              {teacherMode ? "AI Teacher: ON" : "AI Teacher: OFF"}
            </button>
            <button type="button" className="nt-pill" aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <NavIcon name="Bell" size={14} /> {unreadNotifs > 0 ? unreadNotifs : ""}
            </button>
            {signedIn ? (
              <div className="account-chip">
                <span className="account-avatar">{accountEmail.slice(0, 1).toUpperCase() || "U"}</span>
                <button className="subtle-button" onClick={signOut}>Sign out</button>
              </div>
            ) : (
              <button className="primary-button" onClick={() => { setNotice(""); setAuthOpen(true); }}>
                Sign in <span>↗</span>
              </button>
            )}
          </div>
        </header>

        {/* Notification Drawer */}
        {notifOpen && (
          <aside className="nt-notif-drawer" aria-label="Notifications">
            <div className="nt-inline-actions" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <strong>Notifications ({account.notifications.length})</strong>
              <div className="nt-inline-actions">
                <button
                  type="button"
                  className="nt-pill"
                  onClick={() =>
                    setAccount((prev) => ({
                      ...prev,
                      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
                    }))
                  }
                >
                  Mark All Read
                </button>
                <button type="button" className="nt-pill" onClick={() => setNotifOpen(false)}>×</button>
              </div>
            </div>
            <div className="nt-check-list">
              {account.notifications.slice(0, 15).map((n) => (
                <div key={n.id} className={`nt-check-item${n.read ? "" : " passed"}`}>
                  <div>
                    <strong>[{n.category}] {n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="dashboard-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><i /> TRADEGURU AI · EDUCATIONAL PAPER TRADING ECOSYSTEM</div>
              <h1>
                {activeView === "Overview"
                  ? `Welcome back, ${studentName}`
                  : activeView}
              </h1>
              <p>{descriptions[activeView]}</p>
            </div>
            <div className="nt-inline-actions">
              {activeView !== "Trade Terminal" && (
                <button className="primary-button" onClick={() => setActiveView("Trade Terminal")}>
                  Open Pro Terminal →
                </button>
              )}
              <button type="button" className="nt-pill" onClick={() => setActiveView("Reports Center")}>
                Download Reports
              </button>
            </div>
          </div>

          <WorkspaceErrorBoundary viewName={activeView}>
          {activeView === "Overview" && (
            <div className="nt-stack">
              {account.adminConfig.announcements[0] && (
                <article className="truth-card">
                  <span className="truth-icon"><NavIcon name="Announcement" size={13} /></span>
                  <div>
                    <strong>Platform Announcement</strong>
                    <p>{account.adminConfig.announcements[0]}</p>
                  </div>
                </article>
              )}

              <div className="nt-kpi-grid">
                <div className="surface-card nt-kpi">
                  <span className="card-kicker">VIRTUAL EQUITY (DEFAULT ₹10L)</span>
                  <strong>₹{Math.round(netEquity).toLocaleString("en-IN")}</strong>
                  <small>Cash ₹{Math.round(account.availableCash).toLocaleString("en-IN")} · Refills: {account.resetCount}</small>
                </div>
                <div className="surface-card nt-kpi">
                  <span className="card-kicker">UNREALIZED MTM P&amp;L</span>
                  <strong className={unrealizedPnl >= 0 ? "nt-pos" : "nt-neg"}>
                    {formatINR(unrealizedPnl, { signed: true })}
                  </strong>
                  <small>{plural(account.positions.length, "position")} · {plural(isoBaskets.length, "ISO basket")}</small>
                </div>
                <div className="surface-card nt-kpi">
                  <span className="card-kicker">AI TEACHER GRADE</span>
                  <strong>
                    {account.journal.length === 0
                      ? "Unrated"
                      : `${teacherReport.grade} · ${teacherReport.disciplineScore}/100`}
                  </strong>
                  <small>
                    <button type="button" className="nt-link-btn" onClick={() => navigateView(account.journal.length === 0 ? "Trade Terminal" : "AI Teacher")}>
                      {account.journal.length === 0
                        ? "Place your first trade to unlock coaching →"
                        : `${plural(teacherReport.mistakes.length, "coaching item")} →`}
                    </button>
                  </small>
                </div>
                <div className="surface-card nt-kpi">
                  <span className="card-kicker">28-COURSE ACADEMY</span>
                  <strong>{account.completedCourseIds.length} / 28 Courses</strong>
                  <small>
                    <button type="button" className="nt-link-btn" onClick={() => navigateView("Academy")}>
                      Continue learning (EN / हिन्दी) →
                    </button>
                  </small>
                </div>
              </div>

              <TradingViewWidget kind="ticker-tape" title="Market ticker" />

              <div className="dashboard-grid overview-grid">
                <article className="surface-card chart-card">
                  <div className="card-heading">
                    <div><span className="card-kicker">ATTRIBUTED MARKET CHART</span><h2>Live Market Chart</h2></div>
                    <span className="source-tag">TradingView</span>
                  </div>
                  <TradingViewWidget kind="advanced-chart" title="Interactive stock market chart" />
                </article>
                <article className="surface-card overview-market-card">
                  <div className="card-heading">
                    <div><span className="card-kicker">MARKET OVERVIEW</span><h2>Indices, Equities &amp; Global</h2></div>
                  </div>
                  <TradingViewWidget kind="market-overview" title="Market overview" />
                </article>
              </div>
            </div>
          )}

          {activeView === "Trade Terminal" && (
            <ProTerminalView
              account={account}
              quotes={quotes}
              selectedId={selectedInstrumentId}
              onSelectInstrument={setSelectedInstrumentId}
              regime={regime}
              onChangeRegime={setRegime}
              simRunning={simRunning}
              onToggleSim={() => setSimRunning((v) => !v)}
              onPlaceOrder={handlePlaceOrder}
              onToggleWatchlist={(id) =>
                setAccount((prev) => ({
                  ...prev,
                  watchlist: prev.watchlist.includes(id)
                    ? prev.watchlist.filter((x) => x !== id)
                    : [id, ...prev.watchlist],
                }))
              }
              teacherMode={teacherMode}
            />
          )}

          {activeView === "AI Teacher" && (
            <TeacherCoachView
              studentName={studentName}
              account={account}
              teacherMode={teacherMode}
              onToggleTeacherMode={() => setTeacherMode((v) => !v)}
              onNavigateView={(view) => navigateView(view as View)}
            />
          )}

          {activeView === "Academy" && (
            <AcademyView account={account} onCompleteCourse={handleCompleteCourse} />
          )}

          {activeView === "Options Chain" && (
            <OptionsChainView
              quotes={quotes}
              onAddLegToBasket={(leg) => {
                setStagedBasketLegs((prev) => [...prev, leg]);
                setNotice(`Staged ${leg.side} ${leg.customLabel ?? leg.instrumentId} in Basket Orders.`);
              }}
              onQuickTradeOption={(id) => {
                setSelectedInstrumentId(id);
                navigateView("Trade Terminal");
              }}
            />
          )}

          {activeView === "Basket Orders" && (
            <BasketOrdersView
              account={account}
              quotes={quotes}
              stagedLegs={stagedBasketLegs}
              onUpdateStagedLegs={setStagedBasketLegs}
              isoBaskets={isoBaskets}
              onExecuteBasket={handleExecuteBasket}
              onExitIsoBasket={handleExitIsoBasket}
            />
          )}

          {activeView === "Screener" && (
            <ScreenerView
              quotes={quotes}
              onTradeInstrument={(id) => {
                setSelectedInstrumentId(id);
                setActiveView("Trade Terminal");
              }}
            />
          )}

          {activeView === "Risk Center" && (
            <RiskCenterView
              account={account}
              quotes={quotes}
              onUpdateRiskLimits={handleUpdateRiskLimits}
            />
          )}

          {activeView === "Backtesting Lab" && (
            <BacktestLabView account={account} quotes={quotes} />
          )}

          {activeView === "Portfolio" && (
            <PortfolioView
              account={account}
              quotes={quotes}
              onClosePosition={handleClosePosition}
              onCancelOrder={handleCancelOrder}
              onModifyPendingOrder={handleModifyPendingOrder}
              onNavigateToTrade={(id) => {
                setSelectedInstrumentId(id);
                setActiveView("Trade Terminal");
              }}
              onManualRefill={handleManualRefill}
              onSwitchChallenge={handleSwitchChallenge}
            />
          )}

          {activeView === "Journal & Analytics" && (
            <JournalAnalyticsView
              account={account}
              onUpdateReflection={(tradeId, reflection) =>
                setAccount((prev) => ({
                  ...prev,
                  journal: prev.journal.map((t) => (t.id === tradeId ? { ...t, reflection } : t)),
                }))
              }
              onLoadRohitExample={() => {
                const ex = buildRohitExampleJournal(account.brokeragePlan);
                setAccount((prev) => ({
                  ...prev,
                  availableCash: Number((prev.availableCash + ex.netPnl).toFixed(2)),
                  journal: [ex, ...prev.journal],
                }));
                setNotice(`Loaded sample journal trade (Net +₹${ex.netPnl}).`);
              }}
              onTogglePrerequisite={(key) =>
                setAccount((prev) => ({
                  ...prev,
                  prerequisites: { ...prev.prerequisites, [key]: !prev.prerequisites[key] },
                }))
              }
            />
          )}

          {activeView === "Psychology & Challenges" && (
            <PsychologyChallengesView
              studentName={studentName}
              account={account}
              onAddPsychologyLog={handleAddPsychologyLog}
            />
          )}

          {activeView === "Reports Center" && (
            <ReportsCenterView studentName={studentName} account={account} />
          )}

          {activeView === "Market Intel & Admin" && (
            <MarketIntelAdminView
              account={account}
              quotes={quotes}
              onTradeInstrument={(id) => {
                setSelectedInstrumentId(id);
                setActiveView("Trade Terminal");
              }}
              onAdminUpdateConfig={handleAdminUpdateConfig}
            />
          )}

          {activeView === "Watchlist & Alerts" && (
            <AlertsWatchlistView
              account={account}
              quotes={quotes}
              onToggleWatchlist={(id) =>
                setAccount((prev) => ({
                  ...prev,
                  watchlist: prev.watchlist.includes(id)
                    ? prev.watchlist.filter((x) => x !== id)
                    : [id, ...prev.watchlist],
                }))
              }
              onCreateAlert={(params) => {
                const inst = PAPER_INSTRUMENTS.find((i) => i.id === params.instrumentId) ?? PAPER_INSTRUMENTS[0];
                setAccount((prev) => ({
                  ...prev,
                  alerts: [
                    {
                      id: `ALT-${Date.now().toString(36).toUpperCase()}`,
                      instrumentId: inst.id,
                      symbol: inst.symbol,
                      condition: params.condition,
                      targetPrice: params.targetPrice,
                      note: params.note,
                      active: true,
                      createdAt: new Date().toISOString(),
                    },
                    ...prev.alerts,
                  ],
                }));
                setNotice(`Alert created for ${inst.symbol}.`);
              }}
              onDeleteAlert={(alertId) =>
                setAccount((prev) => ({ ...prev, alerts: prev.alerts.filter((a) => a.id !== alertId) }))
              }
              onTradeInstrument={(id) => {
                setSelectedInstrumentId(id);
                setActiveView("Trade Terminal");
              }}
            />
          )}

          {activeView === "Profile" && (
            <section className="surface-card profile-card">
              <div className="card-heading">
                <div><span className="card-kicker">ACCOUNT PROFILE</span><h2>Trader Details</h2></div>
                <span className={`profile-status${profile.fullName.trim() ? " complete" : ""}`}>
                  {profile.fullName.trim() ? "Complete" : "Guest / Incomplete"}
                </span>
              </div>
              {signedIn ? (
                <form className="profile-form" onSubmit={saveProfile}>
                  <label>Email<input type="email" value={accountEmail} readOnly disabled /></label>
                  <label>Full name<input required value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label>
                  <label>Phone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
                  <label>Country<input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} /></label>
                  <button className="primary-button" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save Profile"}</button>
                  {profileNotice && <p className={`profile-feedback${profileNoticeIsError ? " error" : " success"}`}>{profileNotice}</p>}
                </form>
              ) : (
                <>
                  <p>You are in 100% Free Local Paper Mode. Sign in with Supabase anytime to sync your profile.</p>
                  <button className="primary-button" onClick={() => setAuthOpen(true)}>Sign in <span>↗</span></button>
                </>
              )}
            </section>
          )}

          {activeView === "Settings" && (
            <div className="nt-stack">
              <div className="surface-card settings-card">
                <div className="card-heading">
                  <div>
                    <span className="card-kicker">IN-APP CLOUD CONNECTION · NO .ENV FILE REQUIRED</span>
                    <h2>Connect Supabase Cloud Keys</h2>
                    <p>Paste your public Supabase Project URL and Publishable/Anon Key directly here to enable Auth &amp; PostgreSQL Cloud Sync. Never paste a service_role secret key.</p>
                  </div>
                  <span className={`profile-status${supaConnected && signedIn ? " complete" : ""}`}>
                    {supaConnected && signedIn
                      ? "Cloud Synced ✓"
                      : supaConnected
                        ? "Configured · Sign In to Sync"
                        : "Local Mode"}
                  </span>
                </div>
                {supaConnected && !hasSavedSupaKeys && (
                  <p className="market-api-muted" style={{ marginBottom: 10 }}>
                    Deployment environment keys detected. {signedIn ? "Your account is syncing with Supabase." : "Sign in to activate cloud sync, or enter custom keys below to override."}
                  </p>
                )}
                <form
                  className="nt-calc-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      saveSupabaseConfig(supaUrlInput, supaKeyInput);
                      setHasSavedSupaKeys(true);
                      setSupaConnected(true);
                      setNotice("Supabase keys saved in-app! Sign in to start syncing with PostgreSQL.");
                    } catch (err) {
                      setNotice(err instanceof Error ? err.message : "Invalid Supabase keys.");
                    }
                  }}
                >
                  <label style={{ gridColumn: "1/-1" }}>
                    Supabase Project URL
                    <input
                      type="url"
                      required
                      value={supaUrlInput}
                      onChange={(e) => setSupaUrlInput(e.target.value)}
                      placeholder="https://your-project-ref.supabase.co"
                    />
                  </label>
                  <label style={{ gridColumn: "1/-1" }}>
                    Supabase Publishable / Anon Key
                    <input
                      type="password"
                      required
                      value={supaKeyInput}
                      onChange={(e) => setSupaKeyInput(e.target.value)}
                      placeholder="sb_publishable_... or eyJ..."
                    />
                  </label>
                  <div className="nt-inline-actions" style={{ gridColumn: "1/-1" }}>
                    <button type="submit" className="primary-button">Connect Supabase</button>
                    {hasSavedSupaKeys && (
                      <button
                        type="button"
                        className="nt-pill danger"
                        onClick={() => {
                          clearSupabaseConfig();
                          setSupaUrlInput("");
                          setSupaKeyInput("");
                          setHasSavedSupaKeys(false);
                          setSupaConnected(isSupabaseConfigured());
                          setNotice("Disconnected in-app Supabase keys.");
                        }}
                      >
                        Disconnect Keys
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="surface-card settings-card">
                <span className="card-kicker">TRADING &amp; REFILL SETTINGS</span>
                <h2>Execution, Auto-Refill &amp; Notifications</h2>
                <div className="nt-calc-form">
                  <label>
                    Order Confirmation Dialog
                    <select
                      value={account.confirmBeforeOrder ? "ON" : "OFF"}
                      onChange={(e) => setAccount((p) => ({ ...p, confirmBeforeOrder: e.target.value === "ON" }))}
                    >
                      <option value="OFF">Instant Simulated Execution</option>
                      <option value="ON">Ask Confirmation Before Every Order</option>
                    </select>
                  </label>
                  <label>
                    Automatic ₹10L Refill on Depletion
                    <select
                      value={account.autoRefillEnabled ? "ON" : "OFF"}
                      onChange={(e) => setAccount((p) => ({ ...p, autoRefillEnabled: e.target.value === "ON" }))}
                    >
                      <option value="ON">Enabled (Preserves All History)</option>
                      <option value="OFF">Manual Refill Only</option>
                    </select>
                  </label>
                  <label>
                    Brokerage Schedule
                    <select
                      value={account.brokeragePlan}
                      onChange={(e) => setAccount((p) => ({ ...p, brokeragePlan: e.target.value as BrokeragePlan }))}
                    >
                      <option value="ZERO_BROKERAGE">₹0 Zero Brokerage</option>
                      <option value="FLAT_20">₹20 / Order (Discount Broker)</option>
                    </select>
                  </label>
                  <label>
                    Slippage Simulation
                    <select
                      value={account.simulateSlippage ? "ON" : "OFF"}
                      onChange={(e) => setAccount((p) => ({ ...p, simulateSlippage: e.target.value === "ON" }))}
                    >
                      <option value="ON">Enabled ({account.slippageBps} bps)</option>
                      <option value="OFF">Disabled</option>
                    </select>
                  </label>
                </div>
                <div className="nt-inline-actions" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleManualRefill("Manual refill triggered from Settings.")}
                  >
                    Safe Refill +₹10,00,000 (Never Deletes History)
                  </button>
                </div>
              </div>
            </div>
          )}

          </WorkspaceErrorBoundary>
          <footer className="dashboard-footer">
            <span>TradeGuru AI <b>·</b> 100% Free Educational Paper Trading Ecosystem (Simulated Execution — Never Real Exchange Orders)</span>
            <span>
              Market charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a>
            </span>
          </footer>
        </div>
      </section>

      {notice && !authOpen && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {authOpen && !profileSetupOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button>
            <div className="modal-brand">T<span>G</span></div>
            <p className="section-kicker">TRADEGURU AI · 100% FREE</p>
            <h2 id="auth-title">{forgotPassword ? "Reset password" : registering ? "Create free account" : "Welcome back"}</h2>
            <form onSubmit={submitAuth}>
              <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
              {!forgotPassword && <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
              <button className="button button-dark submit-button" disabled={busy}>
                {busy ? "Please wait…" : forgotPassword ? "Send reset link ↗" : registering ? "Create account ↗" : "Sign in ↗"}
              </button>
            </form>
            {notice && <p className="form-notice">{notice}</p>}
            {verificationRequired && !forgotPassword && (
              <p className="switch-auth"><button disabled={busy} onClick={resendVerification}>Resend confirmation email</button></p>
            )}
            <p className="switch-auth">
              <button onClick={() => { setRegistering(!registering); setForgotPassword(false); setNotice(""); }}>
                {registering ? "Already have an account? Sign in" : "New to TradeGuru AI? Create free account"}
              </button>
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
