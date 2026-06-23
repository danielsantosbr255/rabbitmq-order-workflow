package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/danielsantosbr255/payment-service/internal/entity"
	"github.com/danielsantosbr255/payment-service/internal/gateway"
	"github.com/danielsantosbr255/payment-service/internal/repository"
)

type HandleResult struct {
	Ack   bool
	Retry bool
	Fatal bool
	Event *entity.PaymentProcessedEvent
}

type Handler struct {
	repo    repository.PaymentRepository
	gateway gateway.PaymentGateway
	timeout time.Duration
}

func NewHandler(repo repository.PaymentRepository, gw gateway.PaymentGateway, gatewayTimeoutMS int) *Handler {
	return &Handler{
		repo:    repo,
		gateway: gw,
		timeout: time.Duration(gatewayTimeoutMS) * time.Millisecond,
	}
}

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
	if payment, err := h.repo.GetPaymentByOrderID(orderID); err == nil {
		logger.Info("duplicate message detected, returning existing payment processed event")
		outEvent := buildPaymentProcessedEvent(payment)
		return HandleResult{Ack: true, Event: &outEvent}
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

func buildPaymentProcessedEvent(p entity.Payment) entity.PaymentProcessedEvent {
	uuidV7 := uuid.Must(uuid.NewV7())
	return entity.PaymentProcessedEvent{
		EventID:     uuidV7.String(),
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
