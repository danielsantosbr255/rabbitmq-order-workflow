package worker

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	exchangeOrders = "orders"
	exchangeRetry  = "shipping.retry"

	queueMain    = "shipping.process"
	queueWait5s  = "shipping.process.wait.5s"
	queueWait15s = "shipping.process.wait.15s"
	queueWait45s = "shipping.process.wait.45s"
	queueDLQ     = "shipping.process.dlq"

	rkPaymentProcessed = "payment.processed"
)

type Consumer struct {
	conn       *amqp.Connection
	handler    *Handler
	publisher  *Publisher
	prefetch   int
	maxRetries int
	pubMu      sync.Mutex
}

func NewConsumer(conn *amqp.Connection, handler *Handler, publisher *Publisher, prefetch, maxRetries int) *Consumer {
	return &Consumer{
		conn:       conn,
		handler:    handler,
		publisher:  publisher,
		prefetch:   prefetch,
		maxRetries: maxRetries,
	}
}

func (c *Consumer) Run(ctx context.Context, wg *sync.WaitGroup) error {
	ch, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("consumer: open channel: %w", err)
	}
	defer ch.Close()

	if err := c.declareTopology(ch); err != nil {
		return fmt.Errorf("consumer: declare topology: %w", err)
	}

	if err := ch.Qos(c.prefetch, 0, false); err != nil {
		return fmt.Errorf("consumer: set QoS: %w", err)
	}

	pubCh, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("consumer: open publish channel: %w", err)
	}
	defer pubCh.Close()

	deliveries, err := ch.ConsumeWithContext(ctx, queueMain, "shipping-worker", false, false, false, false, nil)
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

func (c *Consumer) dispatch(ctx context.Context, pubCh *amqp.Channel, d amqp.Delivery) {
	retryCount := extractRetryCount(d.Headers)
	logger := slog.With("retry_count", retryCount)

	result := c.handler.Handle(ctx, d.Body)

	switch {
	case result.Fatal:
		logger.Error("fatal error — routing to DLQ")
		finalizeMessage(d, c.publishToDLQ(pubCh, d), logger)

	case result.Retry:
		nextRetry := retryCount + 1
		if nextRetry > c.maxRetries {
			logger.Error("max retries exceeded — routing to DLQ", "max_retries", c.maxRetries)
			finalizeMessage(d, c.publishToDLQ(pubCh, d), logger)
			return
		}
		rk := fmt.Sprintf("retry.%d", nextRetry)
		logger.Warn("transient error — scheduling retry", "routing_key", rk, "next_attempt", nextRetry)
		finalizeMessage(d, c.publishToRetryExchange(pubCh, d, rk, nextRetry), logger)

	case result.Ack:
		if result.Event != nil {
			publishErr := c.publisher.PublishResultEvent(ctx, result.Event, d.CorrelationId)
			finalizeMessage(d, publishErr, logger)
			return
		}
		finalizeMessage(d, nil, logger)
	}
}

func finalizeMessage(d amqp.Delivery, publishErr error, logger *slog.Logger) {
	if publishErr != nil {
		logger.Error("failed to publish message, nacking to requeue", "error", publishErr)
		_ = d.Nack(false, true)
		return
	}
	if err := d.Ack(false); err != nil {
		logger.Error("failed to ack message", "error", err)
	}
}

func (c *Consumer) declareTopology(ch *amqp.Channel) error {
	if err := ch.ExchangeDeclare(exchangeOrders, amqp.ExchangeTopic, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange %q: %w", exchangeOrders, err)
	}

	if err := ch.ExchangeDeclare(exchangeRetry, amqp.ExchangeTopic, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange %q: %w", exchangeRetry, err)
	}

	mainArgs := amqp.Table{
		"x-dead-letter-exchange":    exchangeRetry,
		"x-dead-letter-routing-key": "retry.1",
	}

	if _, err := ch.QueueDeclare(queueMain, true, false, false, false, mainArgs); err != nil {
		return fmt.Errorf("declare queue %q: %w", queueMain, err)
	}
	if err := ch.QueueBind(queueMain, rkPaymentProcessed, exchangeOrders, false, nil); err != nil {
		return fmt.Errorf("bind %q to %q: %w", queueMain, exchangeOrders, err)
	}

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
			"x-message-ttl":             wq.ttl,
			"x-dead-letter-exchange":    exchangeOrders,
			"x-dead-letter-routing-key": rkPaymentProcessed,
		}
		if _, err := ch.QueueDeclare(wq.name, true, false, false, false, args); err != nil {
			return fmt.Errorf("declare wait queue %q: %w", wq.name, err)
		}
		if err := ch.QueueBind(wq.name, wq.rk, exchangeRetry, false, nil); err != nil {
			return fmt.Errorf("bind wait queue %q: %w", wq.name, err)
		}
	}

	if _, err := ch.QueueDeclare(queueDLQ, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare DLQ %q: %w", queueDLQ, err)
	}

	slog.Info("RabbitMQ topology declared successfully")
	return nil
}

func (c *Consumer) publishToRetryExchange(ch *amqp.Channel, d amqp.Delivery, routingKey string, nextRetry int) error {
	c.pubMu.Lock()
	defer c.pubMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	headers := d.Headers
	if headers == nil {
		headers = make(amqp.Table)
	}
	headers["x-retry-count"] = int32(nextRetry)

	err := ch.PublishWithContext(ctx, exchangeRetry, routingKey, false, false, amqp.Publishing{
		ContentType:   d.ContentType,
		DeliveryMode:  amqp.Persistent,
		CorrelationId: d.CorrelationId,
		MessageId:     d.MessageId,
		Body:          d.Body,
		Headers:       headers,
	})
	if err != nil {
		slog.Error("failed to publish to retry exchange", "error", err, "routing_key", routingKey)
		return fmt.Errorf("publish retry: %w", err)
	}
	return nil
}

func (c *Consumer) publishToDLQ(ch *amqp.Channel, d amqp.Delivery) error {
	c.pubMu.Lock()
	defer c.pubMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := ch.PublishWithContext(ctx, "", queueDLQ, false, false, amqp.Publishing{
		ContentType:  d.ContentType,
		DeliveryMode: amqp.Persistent,
		MessageId:    d.MessageId,
		Body:         d.Body,
		Headers:      d.Headers,
	})
	if err != nil {
		slog.Error("failed to publish to DLQ", "error", err)
		return fmt.Errorf("publish dlq: %w", err)
	}
	return nil
}

func extractRetryCount(headers amqp.Table) int {
	if headers == nil {
		return 0
	}
	if count, ok := headers["x-retry-count"].(int32); ok {
		return int(count)
	}
	return 0
}
