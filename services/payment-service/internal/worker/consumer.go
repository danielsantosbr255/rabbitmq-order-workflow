package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/danielsantosbr255/payment-service/internal/entity"
)

// ── Topology constants ────────────────────────────────────────────────────────

const (
	// Main exchange declared by the order-service (must match exactly).
	exchangeOrders = "orders"

	// Dedicated exchange for routing messages to TTL wait queues.
	exchangeRetry = "orders.retry"

	// Main queue where order.placed events land.
	queueMain = "payment.process"

	// Wait queues — messages sit here for their TTL, then return to exchangeOrders.
	queueWait5s  = "payment.process.wait.5s"
	queueWait15s = "payment.process.wait.15s"
	queueWait45s = "payment.process.wait.45s"

	// Terminal dead-letter queue for messages that exhausted all retries.
	queueDLQ = "payment.process.dlq"

	// Routing keys
	rkOrderPlaced = "order.placed"
	rkProcessed   = "payment.processed"
)

// ── Consumer ──────────────────────────────────────────────────────────────────

// Consumer manages the AMQP connection lifecycle, queue topology, and concurrent
// message dispatch. It deliberately knows nothing about business logic — it calls
// Handler.Handle and acts on the returned HandleResult.
type Consumer struct {
	conn        *amqp.Connection
	handler     *Handler
	prefetch    int
	maxRetries  int
}

// NewConsumer constructs a Consumer.
func NewConsumer(conn *amqp.Connection, handler *Handler, prefetch, maxRetries int) *Consumer {
	return &Consumer{
		conn:       conn,
		handler:    handler,
		prefetch:   prefetch,
		maxRetries: maxRetries,
	}
}

// Run sets up the full RabbitMQ topology, starts consuming messages, and blocks
// until ctx is cancelled (graceful shutdown signal).
// The WaitGroup wg must be Done-d by the caller after Run returns.
func (c *Consumer) Run(ctx context.Context, wg *sync.WaitGroup) error {
	ch, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("consumer: open channel: %w", err)
	}
	defer ch.Close()

	if err := c.declareTopology(ch); err != nil {
		return fmt.Errorf("consumer: declare topology: %w", err)
	}

	// QoS — limit unacknowledged messages per consumer (not per channel).
	if err := ch.Qos(c.prefetch, 0, false); err != nil {
		return fmt.Errorf("consumer: set QoS: %w", err)
	}

	// Open a publish channel used by goroutines to send payment.processed events
	// and route retries. A separate channel avoids blocking the consume channel.
	pubCh, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("consumer: open publish channel: %w", err)
	}
	defer pubCh.Close()

	deliveries, err := ch.ConsumeWithContext(
		ctx,
		queueMain,
		"payment-worker",
		false, // autoAck — we control acks manually
		false, false, false, nil,
	)
	if err != nil {
		return fmt.Errorf("consumer: start consume: %w", err)
	}

	slog.Info("consumer ready, waiting for messages",
		"queue", queueMain,
		"prefetch", c.prefetch,
		"max_retries", c.maxRetries,
	)

	for d := range deliveries {
		wg.Add(1)
		go func(d amqp.Delivery) {
			defer wg.Done()
			c.dispatch(ctx, pubCh, d)
		}(d)
	}

	slog.Info("consumer stopped — delivery channel closed")
	return nil
}

// dispatch is called in its own goroutine for each delivery.
// It calls the handler and translates the HandleResult into AMQP actions.
func (c *Consumer) dispatch(ctx context.Context, pubCh *amqp.Channel, d amqp.Delivery) {
	orderID := extractOrderID(d.Body)
	retryCount := extractDeathCount(d.Headers)
	logger := slog.With("order_id", orderID, "retry_count", retryCount)

	result := c.handler.Handle(ctx, d.Body)

	switch {
	case result.Fatal:
		// Poison pill or unrecoverable error — park in DLQ and ack the original.
		logger.Error("fatal error — routing to DLQ")
		c.publishToDLQ(pubCh, d)
		_ = d.Ack(false)

	case result.Retry:
		nextRetry := retryCount + 1
		if nextRetry > c.maxRetries {
			// Exhausted all retries — treat as fatal.
			logger.Error("max retries exceeded — routing to DLQ",
				"max_retries", c.maxRetries,
			)
			c.publishToDLQ(pubCh, d)
			_ = d.Ack(false)
			return
		}
		// Route to the appropriate wait queue via the retry exchange.
		rk := fmt.Sprintf("retry.%d", nextRetry)
		logger.Warn("transient error — scheduling retry", "routing_key", rk, "next_attempt", nextRetry)
		c.publishToRetryExchange(pubCh, d, rk)
		_ = d.Ack(false) // Ack original; a copy is now in the wait queue.

	case result.Ack:
		// Success or idempotent skip.
		if result.Event != nil {
			c.publishPaymentProcessed(pubCh, result.Event, d.CorrelationId)
		}
		_ = d.Ack(false)
	}
}

// ── Topology Declaration ──────────────────────────────────────────────────────

// declareTopology idempotently declares all exchanges, queues, and bindings
// required by the payment worker. Safe to call on every startup.
func (c *Consumer) declareTopology(ch *amqp.Channel) error {
	// Main exchange — declared by order-service too, idempotent (must match args).
	if err := ch.ExchangeDeclare(exchangeOrders, amqp.ExchangeTopic, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange %q: %w", exchangeOrders, err)
	}

	// Retry exchange — routes to the correct TTL wait queue.
	if err := ch.ExchangeDeclare(exchangeRetry, amqp.ExchangeTopic, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange %q: %w", exchangeRetry, err)
	}

	// Main queue — when a message is nacked(requeue=false) by a consumer,
	// it is sent to exchangeRetry. But we use Ack+republish pattern instead,
	// so x-dead-letter-exchange is here only as a safety net.
	mainArgs := amqp.Table{
		"x-dead-letter-exchange":     exchangeRetry,
		"x-dead-letter-routing-key":  "retry.1",
	}
	if _, err := ch.QueueDeclare(queueMain, true, false, false, false, mainArgs); err != nil {
		return fmt.Errorf("declare queue %q: %w", queueMain, err)
	}
	if err := ch.QueueBind(queueMain, rkOrderPlaced, exchangeOrders, false, nil); err != nil {
		return fmt.Errorf("bind %q to %q: %w", queueMain, exchangeOrders, err)
	}

	// TTL wait queues — messages sit here, expire, then return to exchangeOrders
	// with routing key order.placed so they re-enter the main queue.
	waitQueues := []struct {
		name string
		ttl  int32
		rk   string
	}{
		{queueWait5s, 5_000, "retry.1"},
		{queueWait15s, 15_000, "retry.2"},
		{queueWait45s, 45_000, "retry.3"},
	}
	for _, wq := range waitQueues {
		args := amqp.Table{
			"x-message-ttl":              wq.ttl,
			"x-dead-letter-exchange":     exchangeOrders,
			"x-dead-letter-routing-key":  rkOrderPlaced,
		}
		if _, err := ch.QueueDeclare(wq.name, true, false, false, false, args); err != nil {
			return fmt.Errorf("declare wait queue %q: %w", wq.name, err)
		}
		if err := ch.QueueBind(wq.name, wq.rk, exchangeRetry, false, nil); err != nil {
			return fmt.Errorf("bind wait queue %q: %w", wq.name, err)
		}
	}

	// DLQ — terminal queue, no bindings back to any exchange.
	if _, err := ch.QueueDeclare(queueDLQ, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare DLQ %q: %w", queueDLQ, err)
	}

	slog.Info("RabbitMQ topology declared successfully")
	return nil
}

// ── Publishing Helpers ────────────────────────────────────────────────────────

// publishPaymentProcessed publishes the PaymentProcessedEvent back to the main
// exchange so downstream services (e.g. notification-service) can react.
func (c *Consumer) publishPaymentProcessed(ch *amqp.Channel, event *entity.PaymentProcessedEvent, correlationID string) {
	body, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to marshal PaymentProcessedEvent", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5_000_000_000) // 5s
	defer cancel()

	err = ch.PublishWithContext(ctx,
		exchangeOrders, rkProcessed,
		false, false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			MessageId:    event.EventID,
			CorrelationId: correlationID,
			Body:         body,
			Headers: amqp.Table{
				"x-source-service": "payment-service",
				"x-event-type":     "payment.processed",
			},
		},
	)
	if err != nil {
		slog.Error("failed to publish payment.processed", "error", err, "order_id", event.Payload.OrderID)
	}
}

// publishToRetryExchange republishes the delivery body to the retry exchange
// with the routing key matching the correct TTL wait queue (retry.1/2/3).
// The original message is Ack-ed separately by the caller after this returns.
func (c *Consumer) publishToRetryExchange(ch *amqp.Channel, d amqp.Delivery, routingKey string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5_000_000_000)
	defer cancel()

	err := ch.PublishWithContext(ctx,
		exchangeRetry, routingKey,
		false, false,
		amqp.Publishing{
			ContentType:   d.ContentType,
			DeliveryMode:  amqp.Persistent,
			CorrelationId: d.CorrelationId,
			MessageId:     d.MessageId,
			Body:          d.Body,
			Headers:       d.Headers,
		},
	)
	if err != nil {
		slog.Error("failed to publish to retry exchange", "error", err, "routing_key", routingKey)
	}
}

// publishToDLQ directly publishes a copy of the delivery to the DLQ queue
// using the default exchange (empty string) so no binding is required.
func (c *Consumer) publishToDLQ(ch *amqp.Channel, d amqp.Delivery) {
	ctx, cancel := context.WithTimeout(context.Background(), 5_000_000_000)
	defer cancel()

	err := ch.PublishWithContext(ctx,
		"", queueDLQ, // default exchange, routed directly to queue by name
		false, false,
		amqp.Publishing{
			ContentType:  d.ContentType,
			DeliveryMode: amqp.Persistent,
			MessageId:    d.MessageId,
			Body:         d.Body,
			Headers:      d.Headers,
		},
	)
	if err != nil {
		slog.Error("failed to publish to DLQ", "error", err)
	}
}

// ── Header Helpers ────────────────────────────────────────────────────────────

// extractDeathCount reads the x-death header injected by RabbitMQ to determine
// how many times this message has been dead-lettered (i.e., how many retries
// have already occurred). Returns 0 if the header is absent or malformed.
//
// x-death is an array of tables; each entry's "count" field (int64) records
// how many times the message died on a specific queue.
// We sum across all entries to get the total retry count.
func extractDeathCount(headers amqp.Table) int {
	raw, ok := headers["x-death"]
	if !ok {
		return 0
	}
	deaths, ok := raw.([]interface{})
	if !ok {
		return 0
	}
	total := 0
	for _, entry := range deaths {
		table, ok := entry.(amqp.Table)
		if !ok {
			continue
		}
		if count, ok := table["count"].(int64); ok {
			total += int(count)
		}
	}
	return total
}

// extractOrderID attempts a best-effort parse of order_id from the message
// body for logging purposes only. Returns "unknown" on failure.
func extractOrderID(body []byte) string {
	var v struct {
		Payload struct {
			OrderID string `json:"orderId"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(body, &v); err != nil || v.Payload.OrderID == "" {
		return "unknown"
	}
	return v.Payload.OrderID
}
