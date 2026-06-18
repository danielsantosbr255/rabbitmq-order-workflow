package repository

import (
	"github.com/danielsantosbr255/payment-service/internal/entity"
)

// PaymentRepository is the port (interface) for payment persistence.
// Swapping the in-memory implementation for a real database requires
// only a new struct implementing this interface — the handler is untouched.
type PaymentRepository interface {
	// HasPaymentForOrder returns true if a payment record already exists
	// for the given order ID (idempotency check).
	HasPaymentForOrder(orderID string) bool

	// Save persists a Payment record. It is idempotent: calling Save with
	// the same OrderID more than once should not produce duplicate records.
	Save(p entity.Payment) error
}
