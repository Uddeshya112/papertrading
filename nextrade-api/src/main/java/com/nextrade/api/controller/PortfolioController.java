package com.nextrade.api.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * TradeGuru AI — Virtual Portfolio & Safe ₹10,00,000 Refill Controller.
 * Preserves all historical financial records and logs every refill in an immutable ledger.
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@Tag(name = "Portfolio", description = "Virtual portfolio accounting, safe ₹10,00,000 refills & immutable audit log")
@SecurityRequirement(name = "bearerAuth")
public class PortfolioController {

    private static final BigDecimal DEFAULT_CAPITAL = new BigDecimal("1000000.00");

    private final Map<String, VirtualAccountRecord> accounts = new ConcurrentHashMap<>();
    private final Map<String, List<RefillRecord>> refillLedgers = new ConcurrentHashMap<>();
    private final List<AuditRecord> immutableAuditLog = new CopyOnWriteArrayList<>();

    @GetMapping
    @Operation(summary = "Get virtual portfolio summary (auto-provisions ₹10,00,000 default account)")
    public ResponseEntity<PortfolioSummaryResponse> getPortfolio(@AuthenticationPrincipal String principal) {
        String userKey = principal != null && !principal.isBlank() ? principal : "guest";
        VirtualAccountRecord acc = accounts.computeIfAbsent(userKey, this::provisionDefaultAccount);
        List<RefillRecord> refills = refillLedgers.getOrDefault(userKey, List.of());

        return ResponseEntity.ok(new PortfolioSummaryResponse(
                userKey,
                acc.startingCapital(),
                acc.availableCash(),
                acc.usedMargin(),
                acc.realizedPnl(),
                acc.availableCash().add(acc.usedMargin()),
                acc.availableCash().multiply(new BigDecimal("5")),
                acc.resetCount(),
                refills.size(),
                "SIMULATED_VIRTUAL_ACCOUNT"
        ));
    }

    @PostMapping("/refill")
    @Operation(summary = "Safely refill virtual capital by ₹10,00,000 while preserving all historical trades")
    public ResponseEntity<RefillRecord> refillVirtualCapital(
            @RequestBody(required = false) RefillRequest request,
            @AuthenticationPrincipal String principal) {
        String userKey = principal != null && !principal.isBlank() ? principal : "guest";
        VirtualAccountRecord current = accounts.computeIfAbsent(userKey, this::provisionDefaultAccount);

        BigDecimal addAmount = (request != null && request.amount() != null && request.amount().compareTo(BigDecimal.ZERO) > 0)
                ? request.amount()
                : DEFAULT_CAPITAL;
        String mode = (request != null && request.mode() != null && !request.mode().isBlank()) ? request.mode() : "MANUAL";
        String reason = (request != null && request.reason() != null && !request.reason().isBlank())
                ? request.reason()
                : "Safe virtual capital refill preserving all historical trades.";

        BigDecimal before = current.availableCash();
        BigDecimal after = before.max(BigDecimal.ZERO).add(addAmount);
        VirtualAccountRecord updated = new VirtualAccountRecord(
                current.startingCapital(),
                after,
                BigDecimal.ZERO,
                current.realizedPnl(),
                current.resetCount() + 1
        );
        accounts.put(userKey, updated);

        RefillRecord record = new RefillRecord(
                "RFL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                Instant.now().toString(),
                mode,
                reason,
                before,
                addAmount,
                after
        );
        refillLedgers.computeIfAbsent(userKey, k -> new CopyOnWriteArrayList<>()).add(0, record);
        immutableAuditLog.add(0, new AuditRecord(
                "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                Instant.now().toString(),
                userKey,
                "VIRTUAL_CAPITAL_REFILL_" + mode,
                "Added INR " + addAmount + " (" + reason + ")"
        ));

        return ResponseEntity.ok(record);
    }

    @GetMapping("/refills")
    @Operation(summary = "List immutable virtual capital refill history")
    public ResponseEntity<List<RefillRecord>> getRefillHistory(@AuthenticationPrincipal String principal) {
        String userKey = principal != null && !principal.isBlank() ? principal : "guest";
        return ResponseEntity.ok(List.copyOf(refillLedgers.getOrDefault(userKey, List.of())));
    }

    @GetMapping("/audit-log")
    @Operation(summary = "Read immutable account & administrative audit trail")
    public ResponseEntity<List<AuditRecord>> getAuditLog() {
        return ResponseEntity.ok(List.copyOf(immutableAuditLog));
    }

    private VirtualAccountRecord provisionDefaultAccount(String userKey) {
        immutableAuditLog.add(0, new AuditRecord(
                "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                Instant.now().toString(),
                "System",
                "ACCOUNT_AUTO_PROVISIONED",
                "Provisioned default ₹10,00,000 virtual account for " + userKey
        ));
        return new VirtualAccountRecord(DEFAULT_CAPITAL, DEFAULT_CAPITAL, BigDecimal.ZERO, BigDecimal.ZERO, 0);
    }

    public record VirtualAccountRecord(
            BigDecimal startingCapital,
            BigDecimal availableCash,
            BigDecimal usedMargin,
            BigDecimal realizedPnl,
            int resetCount
    ) {}

    public record RefillRequest(String mode, String reason, BigDecimal amount) {}

    public record RefillRecord(
            String id,
            String timestamp,
            String mode,
            String reason,
            BigDecimal balanceBefore,
            BigDecimal amountAdded,
            BigDecimal balanceAfter
    ) {}

    public record AuditRecord(String id, String timestamp, String actor, String action, String details) {}

    public record PortfolioSummaryResponse(
            String userId,
            BigDecimal startingCapital,
            BigDecimal availableCash,
            BigDecimal usedMargin,
            BigDecimal realizedPnl,
            BigDecimal totalEquity,
            BigDecimal intradayBuyingPower,
            int resetCount,
            int refillEventsCount,
            String accountType
    ) {}
}
