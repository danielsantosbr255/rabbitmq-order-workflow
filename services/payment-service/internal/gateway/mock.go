package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math/big"
	"time"
)

// ErrTransient signals a temporary failure that may succeed on retry.
// The consumer uses this sentinel to route the message to the appropriate
// TTL wait queue instead of sending it straight to the DLQ.
var ErrTransient = errors.New("gateway: transient error, eligible for retry")

// MockGateway simulates a real external payment provider with realistic
// latency and a configurable probability of transient failure.
//
// Behaviour:
//   - ~80% success: sleeps 200–500ms and returns a UUID transaction ID.
//   - ~20% failure: sleeps 100ms (fast-fail) and returns ErrTransient,
//     so the consumer exercises the full retry + wait-queue path.
type MockGateway struct{}

// NewMockGateway constructs a MockGateway.
func NewMockGateway() *MockGateway {
	return &MockGateway{}
}

// Charge implements PaymentGateway.
func (g *MockGateway) Charge(ctx context.Context, orderID string) (string, error) {
	// Simulate ~20% transient failure (e.g. gateway timeout, 503)
	n, err := rand.Int(rand.Reader, big.NewInt(100))
	if err != nil {
		return "", ErrTransient
	}

	if n.Int64() < 20 {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
		return "", ErrTransient
	}

	// Simulate realistic processing latency (200–500ms)
	delay := 200 + n.Int64()%300 // 200-499ms
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(time.Duration(delay) * time.Millisecond):
	}

	txID, err := generateID()
	if err != nil {
		return "", ErrTransient
	}
	return txID, nil
}

// generateID produces a random hex string suitable for use as a transaction ID.
func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
