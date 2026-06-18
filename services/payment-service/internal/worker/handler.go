package worker

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/danielsantosbr255/payment-service/internal/entity"
	"github.com/danielsantosbr255/payment-service/internal/gateway"
	"github.com/danielsantosbr255/payment-service/internal/repository"
)

// HandleResult is returned by Handler.Handle and tells the consumer
// exactly how to ack/nack/retry the AMQP delivery.
type HandleResult struct {
	// Ack indicates the message was processed successfully (or idempotently skipped).
	Ack bool
	// Retry indicates a transient error — the consumer should route to a wait queue.
	Retry bool
	// Fatal indicates a permanent failure — the consumer should route to the DLQ.
	Fatal bool
	// Event is non-nil when a payment.processed event must be published back.
	Event *entity.PaymentProcessedEvent
}

// Handler orchestrates the core business logic of the payment worker.
// It has no knowledge of AMQP, queues, or retry infrastructure — it only
// knows about the domain: idempotency, gateway, and repository.
type Handler struct {
	repo    repository.PaymentRepository
	gateway gateway.PaymentGateway
	timeout time.Duration
}

// NewHandler constructs a Handler with its dependencies injected.
func NewHandler(repo repository.PaymentRepository, gw gateway.PaymentGateway, gatewayTimeoutMS int) *Handler {
	return &Handler{
		repo:    repo,
		gateway: gw,
		timeout: time.Duration(gatewayTimeoutMS) * time.Millisecond,
	}
}

// Handle processes a raw AMQP message body containing an OrderPlacedEvent.
// It returns a HandleResult that drives the consumer's ack/retry/DLQ decision.
func (h *Handler) Handle(ctx context.Context, body []byte) HandleResult {
	var event entity.OrderPlacedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		slog.Error("failed to unmarshal OrderPlacedEvent — poison pill, routing to DLQ",
			"error", err,
			"body", string(body),
		)
		return HandleResult{Fatal: true}
	}

	orderID := event.Payload.OrderID
	logger := slog.With("order_id", orderID, "event_id", event.EventID)

	// --- Idempotency Check ---
	if h.repo.HasPaymentForOrder(orderID) {
		logger.Info("duplicate message detected, skipping (already processed)")
		return HandleResult{Ack: true}
	}

	// --- Gateway Charge ---
	chargeCtx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()

	transactionID, err := h.gateway.Charge(chargeCtx, orderID)
	if err != nil {
		logger.Warn("gateway charge failed", "error", err)
		return HandleResult{Retry: true}
	}

	// --- Persist Result ---
	payment := entity.Payment{
		OrderID:       orderID,
		TransactionID: transactionID,
		Status:        entity.StatusApproved,
		ProcessedAt:   time.Now().UTC(),
	}
	if saveErr := h.repo.Save(payment); saveErr != nil {
		logger.Error("failed to persist payment record", "error", saveErr)
		return HandleResult{Retry: true}
	}

	// --- Build Response Event ---
	outEvent := buildPaymentProcessedEvent(payment)
	logger.Info("payment approved", "transaction_id", transactionID)
	return HandleResult{Ack: true, Event: &outEvent}
}

// buildPaymentProcessedEvent constructs the outbound event envelope using
// the same structure as the order-service events for consistency.
func buildPaymentProcessedEvent(p entity.Payment) entity.PaymentProcessedEvent {
	return entity.PaymentProcessedEvent{
		EventID:     newUUID(),
		EventType:   "payment.processed",
		AggregateID: p.OrderID,
		OccurredAt:  time.Now().UTC().Format(time.RFC3339Nano),
		Version:     1,
		Payload: entity.PaymentProcessedPayload{
			OrderID:       p.OrderID,
			TransactionID: p.TransactionID,
			Status:        p.Status,
			ProcessedAt:   p.ProcessedAt.Format(time.RFC3339Nano),
		},
	}
}

// newUUID generates a random UUID v4 using crypto/rand.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
