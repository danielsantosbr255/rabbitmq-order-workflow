package worker

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/danielsantosbr255/notification-service/internal/entity"
	"github.com/danielsantosbr255/notification-service/internal/gateway"
)

type HandleResult int

const (
	ResultSuccess HandleResult = iota
	ResultDrop
	ResultRetry
)

// Handler processes the incoming events and maps them to email notifications
type Handler struct {
	emailGateway gateway.EmailGateway
}

// NewHandler creates a new handler
func NewHandler(gw gateway.EmailGateway) *Handler {
	return &Handler{emailGateway: gw}
}

// Handle executes the notification business logic based on routing key
func (h *Handler) Handle(ctx context.Context, routingKey string, body []byte) HandleResult {
	logger := slog.With("routing_key", routingKey)

	// Decode the base payload to get the orderID
	var base entity.BaseEventPayload
	if err := json.Unmarshal(body, &base); err != nil || base.OrderID == "" {
		// Attempt to read from an envelope just in case it's nested
		var envelope entity.EventEnvelope
		if errEnv := json.Unmarshal(body, &envelope); errEnv == nil && envelope.AggregateID != "" {
			base.OrderID = envelope.AggregateID
		}

		// If still empty, try "order_id" fallback, though usually not needed if standard is followed
		if base.OrderID == "" {
			logger.Warn("malformed payload or missing orderId", "body", string(body))
			return ResultDrop
		}
	}

	orderID := base.OrderID
	logger = logger.With("order_id", orderID)

	var subject, message string

	switch routingKey {
	case "order.placed":
		subject = "Pedido Recebido"
		message = "Seu pedido foi recebido e estamos aguardando a confirmação do pagamento!"

	case "payment.processed":
		var evt struct {
			Payload entity.PaymentProcessedPayload `json:"payload"`
		}
		if err := json.Unmarshal(body, &evt); err != nil {
			logger.Error("failed to decode payment payload", "error", err)
			return ResultDrop
		}

		paymentPayload := evt.Payload
		switch paymentPayload.Status {
		case entity.PaymentStatusApproved:
			subject = "Pagamento Aprovado"
			message = "Pagamento aprovado! Seu pedido está sendo preparado para envio."
		case entity.PaymentStatusRejected:
			subject = "Pagamento Recusado"
			message = "Pagamento recusado. Pedido cancelado."
		default:
			logger.Warn("unknown payment status", "status", paymentPayload.Status)
			return ResultDrop
		}

	case "shipping.completed":
		subject = "Pedido Despachado"
		message = "Seu pedido foi despachado e está a caminho!"

	case "payment.refunded":
		subject = "Pedido Cancelado e Estornado"
		message = "Houve um problema logístico. Seu pedido foi cancelado e o valor estornado."

	default:
		logger.Warn("unknown routing key ignored")
		return ResultDrop
	}

	// Dispatch the email
	err := h.emailGateway.SendEmail(ctx, orderID, subject, message)
	if err != nil {
		logger.Warn("failed to send email notification", "error", err)
		return ResultRetry // Will cause exponential backoff
	}

	logger.Info("notification email sent successfully")
	return ResultSuccess
}
