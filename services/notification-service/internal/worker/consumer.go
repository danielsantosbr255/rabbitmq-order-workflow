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
	exchangeRetry  = "notification.retry"
	queueProcess   = "notification.process"
	queueWait5s    = "notification.process.wait.5s"
	queueWait15s   = "notification.process.wait.15s"
	queueWait45s   = "notification.process.wait.45s"
	queueDLQ       = "notification.process.dlq"
)

var routingKeys = []string{
	"order.placed",
	"payment.processed",
	"shipping.completed",
	"payment.refunded",
}

// Consumer handles RabbitMQ message consumption and topology setup
type Consumer struct {
	conn    *amqp.Connection
	handler *Handler
	wg      sync.WaitGroup
	ctx     context.Context
	cancel  context.CancelFunc
}

// NewConsumer creates a new Consumer
func NewConsumer(conn *amqp.Connection, handler *Handler) *Consumer {
	ctx, cancel := context.WithCancel(context.Background())
	return &Consumer{
		conn:    conn,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// SetupTopology creates exchanges, queues, and bindings
func (c *Consumer) SetupTopology() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open channel: %w", err)
	}
	defer ch.Close()

	// 1. Declare exchanges
	if err := ch.ExchangeDeclare(exchangeOrders, "topic", true, false, false, false, nil); err != nil {
		return err
	}
	if err := ch.ExchangeDeclare(exchangeRetry, "topic", true, false, false, false, nil); err != nil {
		return err
	}

	// 2. Declare queues
	_, err = ch.QueueDeclare(queueProcess, true, false, false, false, nil)
	if err != nil {
		return err
	}

	// Wait Queues (dead lettering back to orders exchange with the original routing key)
	waitQueues := []struct {
		name string
		ttl  int32
	}{
		{queueWait5s, 5000},
		{queueWait15s, 15000},
		{queueWait45s, 45000},
	}

	for _, wq := range waitQueues {
		args := amqp.Table{
			"x-dead-letter-exchange": exchangeOrders,
			"x-message-ttl":          wq.ttl,
		}
		if _, err := ch.QueueDeclare(wq.name, true, false, false, false, args); err != nil {
			return err
		}
	}

	// DLQ
	if _, err := ch.QueueDeclare(queueDLQ, true, false, false, false, nil); err != nil {
		return err
	}

	// 3. Bindings
	for _, rk := range routingKeys {
		if err := ch.QueueBind(queueProcess, rk, exchangeOrders, false, nil); err != nil {
			return err
		}
	}

	if err := ch.QueueBind(queueWait5s, "retry.1", exchangeRetry, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(queueWait15s, "retry.2", exchangeRetry, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(queueWait45s, "retry.3", exchangeRetry, false, nil); err != nil {
		return err
	}

	return nil
}

// Start begins consuming messages
func (c *Consumer) Start(prefetchCount int) error {
	ch, err := c.conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open channel: %w", err)
	}

	if err := ch.Qos(prefetchCount, 0, false); err != nil {
		return fmt.Errorf("failed to set Qos: %w", err)
	}

	msgs, err := ch.Consume(queueProcess, "notification-worker", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("failed to start consumer: %w", err)
	}

	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		defer ch.Close()

		for {
			select {
			case <-c.ctx.Done():
				slog.Info("shutting down consumer...")
				return
			case msg, ok := <-msgs:
				if !ok {
					slog.Info("message channel closed")
					return
				}
				c.processMessage(ch, msg)
			}
		}
	}()

	slog.Info("notification consumer started", "queue", queueProcess)
	return nil
}

func (c *Consumer) processMessage(ch *amqp.Channel, msg amqp.Delivery) {
	// Parse retry count from headers
	retryCount := int32(0)
	if msg.Headers != nil {
		if count, ok := msg.Headers["x-retry-count"].(int32); ok {
			retryCount = count
		}
	}

	// Get original routing key. If it came from a wait queue, it might have been modified by the retry exchange.
	routingKey := msg.RoutingKey
	if orig, ok := msg.Headers["x-original-routing-key"].(string); ok {
		routingKey = orig
	}

	result := c.handler.Handle(c.ctx, routingKey, msg.Body)

	switch result {
	case ResultSuccess:
		msg.Ack(false)
	case ResultDrop:
		// Message is malformed or unprocessable permanently
		slog.Warn("dropping message permanently", "routing_key", routingKey)
		// We manually publish to DLQ because our queueProcess doesn't have a DLX by default
		c.moveToDLQ(ch, msg, "dropped by handler")
		msg.Ack(false) // Acknowledge to remove from main queue
	case ResultRetry:
		retryCount++
		var nextRetryRoutingKey string
		switch retryCount {
		case 1:
			nextRetryRoutingKey = "retry.1"
		case 2:
			nextRetryRoutingKey = "retry.2"
		case 3:
			nextRetryRoutingKey = "retry.3"
		default:
			// Max retries exceeded
			slog.Error("max retries exceeded, sending to DLQ", "routing_key", routingKey)
			c.moveToDLQ(ch, msg, "max retries exceeded")
			msg.Ack(false)
			return
		}

		headers := amqp.Table{
			"x-retry-count":          retryCount,
			"x-original-routing-key": routingKey,
		}

		// Copy existing headers
		if msg.Headers != nil {
			for k, v := range msg.Headers {
				if k != "x-retry-count" && k != "x-original-routing-key" {
					headers[k] = v
				}
			}
		}

		err := ch.PublishWithContext(c.ctx, exchangeRetry, nextRetryRoutingKey, false, false, amqp.Publishing{
			Headers:      headers,
			ContentType:  msg.ContentType,
			DeliveryMode: msg.DeliveryMode,
			Body:         msg.Body,
			MessageId:    msg.MessageId,
			Timestamp:    time.Now(),
		})

		if err != nil {
			slog.Error("failed to publish to retry exchange", "error", err)
			msg.Nack(false, true) // requeue locally
			return
		}

		msg.Ack(false)
	}
}

func (c *Consumer) moveToDLQ(ch *amqp.Channel, msg amqp.Delivery, reason string) {
	headers := msg.Headers
	if headers == nil {
		headers = amqp.Table{}
	}
	headers["x-dlq-reason"] = reason

	err := ch.PublishWithContext(c.ctx, "", queueDLQ, false, false, amqp.Publishing{
		Headers:      headers,
		ContentType:  msg.ContentType,
		DeliveryMode: msg.DeliveryMode,
		Body:         msg.Body,
		MessageId:    msg.MessageId,
		Timestamp:    time.Now(),
	})
	if err != nil {
		slog.Error("failed to send message to DLQ", "error", err)
	}
}

// Stop gracefully shuts down the consumer
func (c *Consumer) Stop() {
	c.cancel()
	c.wg.Wait()
}
