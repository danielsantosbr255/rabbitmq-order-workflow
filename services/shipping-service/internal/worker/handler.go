package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/danielsantosbr255/shipping-service/internal/entity"
	"github.com/danielsantosbr255/shipping-service/internal/gateway"
)

type HandleResult struct {
	Ack   bool
	Retry bool
	Fatal bool
	Event *entity.ShippingResultEvent
}

type Handler struct {
	gateway gateway.CarrierGateway
}

func NewHandler(gw gateway.CarrierGateway) *Handler {
	return &Handler{gateway: gw}
}

func (h *Handler) Handle(ctx context.Context, body []byte) HandleResult {
	var event entity.PaymentProcessedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		slog.Error("failed to unmarshal PaymentProcessedEvent - poison pill, routing to DLQ", "error", err, "body", string(body))
		return HandleResult{Fatal: true}
	}

	orderID := event.Payload.OrderID
	logger := slog.With("order_id", orderID, "event_id", event.EventID)

	if event.Payload.Status == entity.PaymentStatusRejected {
		logger.Info("payment was rejected, ignoring shipping request")
		return HandleResult{Ack: true}
	}

	if event.Payload.Status != entity.PaymentStatusApproved {
		logger.Warn("unknown payment status, ignoring", "status", event.Payload.Status)
		return HandleResult{Ack: true}
	}

	logger.Info("processing approved payment for shipping")

	err := h.gateway.Dispatch(ctx, orderID)

	if err != nil {
		if strings.Contains(err.Error(), "invalid shipping address") {
			logger.Warn("permanent carrier error, shipping failed", "error", err)
			outEvent := buildResultEvent(event.Payload, entity.StatusFailed, err.Error())
			return HandleResult{Ack: true, Event: &outEvent}
		}
		logger.Warn("transient carrier error, will retry", "error", err)
		return HandleResult{Retry: true}
	}

	logger.Info("shipping dispatched successfully")
	outEvent := buildResultEvent(event.Payload, entity.StatusDispatched, "")
	return HandleResult{Ack: true, Event: &outEvent}
}

func buildResultEvent(p entity.PaymentProcessedPayload, status entity.ShippingStatus, reason string) entity.ShippingResultEvent {
	uuidV7 := uuid.Must(uuid.NewV7())
	eventType := "shipping.completed"
	if status == entity.StatusFailed {
		eventType = "shipping.failed"
	}

	return entity.ShippingResultEvent{
		EventID:     uuidV7.String(),
		EventType:   eventType,
		AggregateID: p.OrderID,
		OccurredAt:  time.Now().UTC().Format(time.RFC3339Nano),
		Version:     1,
		Payload: entity.ShippingResultPayload{
			OrderID:       p.OrderID,
			TransactionID: p.TransactionID,
			Status:        status,
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339Nano),
			Reason:        reason,
		},
	}
}
