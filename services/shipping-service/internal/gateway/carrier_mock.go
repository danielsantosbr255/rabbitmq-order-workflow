package gateway

import (
	"context"
	"errors"
	"math/rand"
	"time"
)

// CarrierGateway defines the interface for interacting with the external shipping carrier
type CarrierGateway interface {
	Dispatch(ctx context.Context, orderID string) error
}

type carrierMock struct {
	rng *rand.Rand
}

// NewCarrierMock creates a new mock instance with a seeded random number generator
func NewCarrierMock() CarrierGateway {
	return &carrierMock{
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Dispatch simulates a call to an external carrier API
func (m *carrierMock) Dispatch(ctx context.Context, orderID string) error {
	// Simulate network latency
	select {
	case <-time.After(time.Duration(m.rng.Intn(500)+100) * time.Millisecond):
	case <-ctx.Done():
		return ctx.Err()
	}

	roll := m.rng.Intn(100)

	// 10% chance of transient error (timeout, 5xx) -> triggers retry
	if roll < 10 {
		return errors.New("carrier API timeout")
	}

	// 5% chance of permanent error (invalid address) -> triggers compensation
	if roll >= 10 && roll < 15 {
		return errors.New("invalid shipping address")
	}

	// 85% chance of success
	return nil
}
