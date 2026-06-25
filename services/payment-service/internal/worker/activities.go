package worker

import (
	"context"
	"time"

	"github.com/danielsantosbr255/payment-service/internal/entity"
	"github.com/danielsantosbr255/payment-service/internal/gateway"
	"github.com/danielsantosbr255/payment-service/internal/repository"
)

type PaymentActivities struct {
	repo    repository.PaymentRepository
	gateway gateway.PaymentGateway
	timeout time.Duration
}

func NewPaymentActivities(repo repository.PaymentRepository, gw gateway.PaymentGateway, timeout time.Duration) *PaymentActivities {
	return &PaymentActivities{
		repo:    repo,
		gateway: gw,
		timeout: timeout,
	}
}

func (a *PaymentActivities) ProcessPayment(ctx context.Context, orderID string, customerID string, amount float64) error {
	// --- Idempotency Check using domain data ---
	existingPayment, err := a.repo.GetPaymentByOrderID(orderID)
	if err == nil && existingPayment.Status == entity.StatusApproved {
		return nil // Already processed, return success implicitly
	}

	// --- Gateway Charge ---
	chargeCtx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()

	transactionID, err := a.gateway.Charge(chargeCtx, orderID, customerID, amount)
	if err != nil {
		return err // Temporal will auto-retry based on the policy
	}

	// --- Persist Result ---
	payment := entity.Payment{
		OrderID:       orderID,
		TransactionID: transactionID,
		Status:        entity.StatusApproved,
		ProcessedAt:   time.Now().UTC(),
	}
	if saveErr := a.repo.Save(payment); saveErr != nil {
		return saveErr
	}

	return nil
}

func (a *PaymentActivities) RefundPayment(ctx context.Context, orderID string, customerID string, amount float64) error {
	// --- Check if payment exists ---
	payment, err := a.repo.GetPaymentByOrderID(orderID)
	if err != nil {
		// If there's no payment to refund, it's fine, return nil
		return nil
	}

	// --- Idempotency Check using domain data ---
	if payment.Status == entity.StatusRefunded {
		return nil // Already refunded, idempotency
	}

	// --- Gateway Refund ---
	refundCtx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()

	// Using the same Charge interface for simplicity, assuming the gateway handles negative amounts or a specific method
	_, err = a.gateway.Charge(refundCtx, "REFUND_"+orderID, customerID, amount)
	if err != nil {
		return err // Temporal will auto-retry
	}

	// --- Persist Refund ---
	payment.Status = entity.StatusRefunded
	if saveErr := a.repo.Save(payment); saveErr != nil {
		return saveErr
	}

	return nil
}
