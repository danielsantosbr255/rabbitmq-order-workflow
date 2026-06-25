package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math/big"
	"time"
)

var ErrTransient = errors.New("gateway: transient error, eligible for retry")
var ErrPermanent = errors.New("gateway: permanent payment declined")

type MockGateway struct{}

func NewMockGateway() *MockGateway {
	return &MockGateway{}
}

func (g *MockGateway) Charge(ctx context.Context, orderID string, customerID string, amount float64) (string, error) {
	if customerID == "00000000-0000-4000-8000-000000000001" {
		return "", ErrPermanent
	}

	n, err := rand.Int(rand.Reader, big.NewInt(100))
	if err != nil {
		return "", ErrTransient
	}

	// Optional: keep transient error simulation for non-E2E runs
	// but let's disable random failures if customerID starts with "E2E_"
	// to ensure tests don't flake due to random timeouts.
	if n.Int64() < 20 && customerID != "E2E_SUCCESS" {
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
