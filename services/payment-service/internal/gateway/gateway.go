package gateway

import "context"

// PaymentGateway is the port (interface) for the payment processing adapter.
// Any implementation — mock, Stripe, PagSeguro, etc. — satisfies this interface,
// keeping the worker handler decoupled from external infrastructure.
type PaymentGateway interface {
	// Charge attempts to charge the given order and returns a unique transaction ID
	// on success, or an error if the charge could not be completed.
	//
	// Implementations must respect ctx cancellation/timeout.
	Charge(ctx context.Context, orderID string) (transactionID string, err error)
}
