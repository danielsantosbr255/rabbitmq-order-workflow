package gateway

import "context"

type PaymentGateway interface {
	Charge(ctx context.Context, orderID string, customerID string, amount float64) (transactionID string, err error)
}
