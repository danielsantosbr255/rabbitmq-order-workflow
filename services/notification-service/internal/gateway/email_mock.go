package gateway

import (
	"context"
	"errors"
	"log/slog"
	"math/rand"
	"time"
)

// EmailGateway defines the interface for interacting with the external email provider
type EmailGateway interface {
	SendEmail(ctx context.Context, orderID, subject, body string) error
}

type emailMock struct {
	rng *rand.Rand
}

// NewEmailMock creates a new mock instance with a seeded random number generator
func NewEmailMock() EmailGateway {
	return &emailMock{
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// SendEmail simulates sending an email notification
func (m *emailMock) SendEmail(ctx context.Context, orderID, subject, body string) error {
	// Simulate network latency (50-200ms)
	select {
	case <-time.After(time.Duration(m.rng.Intn(150)+50) * time.Millisecond):
	case <-ctx.Done():
		return ctx.Err()
	}

	roll := m.rng.Intn(100)

	// 5% chance of transient error (timeout, 5xx) -> triggers retry
	if roll < 5 {
		return errors.New("email provider timeout")
	}

	slog.Info("email sent successfully", "order_id", orderID, "subject", subject, "body", body)

	// 95% chance of success
	return nil
}
