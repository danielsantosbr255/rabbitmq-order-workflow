package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/danielsantosbr255/shipping-service/internal/entity"
)

// Publisher handles publishing events to RabbitMQ
type Publisher struct {
	conn  *amqp.Connection
	mu    sync.Mutex
	pubCh *amqp.Channel
}

// NewPublisher creates a new Publisher
func NewPublisher(conn *amqp.Connection) (*Publisher, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open publish channel: %w", err)
	}

	return &Publisher{
		conn:  conn,
		pubCh: ch,
	}, nil
}

// Close closes the publishing channel
func (p *Publisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pubCh != nil {
		return p.pubCh.Close()
	}
	return nil
}

// PublishResultEvent publishes a shipping.completed or shipping.failed event
func (p *Publisher) PublishResultEvent(ctx context.Context, event *entity.ShippingResultEvent, correlationID string) error {
	body, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to marshal ShippingResultEvent", "error", err)
		return fmt.Errorf("marshal event: %w", err)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	pubCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = p.pubCh.PublishWithContext(pubCtx, exchangeOrders, event.EventType, false, false, amqp.Publishing{
		ContentType:   "application/json",
		DeliveryMode:  amqp.Persistent,
		MessageId:     event.EventID,
		CorrelationId: correlationID,
		Body:          body,
		Headers: amqp.Table{
			"x-source-service": "shipping-service",
			"x-event-type":     event.EventType,
		},
	})

	if err != nil {
		slog.Error("failed to publish shipping result event", "error", err, "order_id", event.Payload.OrderID, "event_type", event.EventType)
		return fmt.Errorf("publish event: %w", err)
	}

	return nil
}
