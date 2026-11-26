# TradeGuru AI — Low-Level Design (LLD)

## 1. Domain Class Diagram

```mermaid
classDiagram
    class PaperAccountState {
        +number startingCapital
        +number availableCash
        +number resetCount
        +RiskLimitsConfig riskLimits
        +PaperPosition[] positions
        +PaperOrder[] orders
        +JournalTrade[] journal
        +RefillEvent[] refillHistory
    }
    class PaperOrder {
        +string id
        +OrderSide side
        +OrderType orderType
        +OrderStatus status
        +number quantity
        +number filledQuantity
        +number charges
    }
    class JournalTrade {
        +string id
        +number entryPrice
        +number exitPrice
        +number grossPnl
        +number charges
        +number netPnl
        +boolean followedStopLoss
        +string reflection
    }
    class MarketDataProvider {
        <<interface>>
        +string name
        +FeedMode mode
        +fetchQuotes(ids) Promise~QuoteMap~
    }
    class TeacherCoachEngine {
        +evaluatePreTradeMistakes(order) PreTradeFeedback[]
        +diagnoseTradingReport(account) TeacherReport
    }
    PaperAccountState "1" *-- "*" PaperOrder
    PaperAccountState "1" *-- "*" JournalTrade
    TeacherCoachEngine ..> PaperAccountState : analyzes
```

## 2. Order Placement & Cloud Sync Sequence Diagram

```mermaid
sequenceDiagram
    actor Trader
    participant UI as ProTerminalView
    participant Teacher as TeacherCoach
    participant Engine as PaperEngine
    participant Queue as OfflineSyncQueue
    participant DB as Supabase PostgreSQL

    Trader->>UI: Configure Order (Side, Type, Qty, SL, Target)
    UI->>Teacher: evaluatePreTradeMistakes(draft)
    Teacher-->>UI: PreTradeFeedback[] (Guardrails / Auto-Fix)
    Trader->>UI: Submit Order
    UI->>Engine: placePaperOrder(state, input, quote)
    Engine->>Engine: Validate margin, shorting, SL/Target, partial fill
    Engine-->>UI: Updated PaperAccountState + Notification
    UI->>Queue: enqueueSync(userId, updatedState, idempotencyKey)
    alt Online
        Queue->>DB: Upsert account + Append immutable journal/refills
        DB-->>Queue: 200 OK
    else Offline / Network Failure
        Queue->>Queue: Persist pending payload + Exponential backoff retry
    end
```

## 3. Design Patterns & SOLID Principles
* **Strategy Pattern:** `MarketDataProvider` (`SimulatedRegimeProvider`, `YahooDelayedProvider`, future broker WebSockets) and `BacktestRuleType` (`EMA_CROSS`, `RSI_MEAN_REVERSION`, `BOLLINGER_BREAKOUT`, `MACD_MOMENTUM`).
* **Pure Reducer Functions:** `placePaperOrder`, `closePaperPosition`, `performSafeAccountRefill`, and `processMarketTickOnAccount` are pure state transitions—deterministic, unit-testable, and free of side effects.
* **Circuit Breaker & Token Bucket:** Applied in `/api/market/quotes` to protect upstream Yahoo Finance calls and prevent abuse.
* **Dependency Inversion:** UI components depend on typed domain contracts (`LiveQuote`, `PaperAccountState`, `TeacherReport`) rather than storage or transport details.
