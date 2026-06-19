package repository

import (
	"github.com/danielsantosbr255/payment-service/internal/entity"
)

type PaymentRepository interface {
	GetPaymentByOrderID(orderID string) (entity.Payment, error)
	Save(p entity.Payment) error
}
