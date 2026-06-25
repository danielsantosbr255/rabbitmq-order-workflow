package worker

import (
	"context"

	"go.temporal.io/sdk/activity"

	"github.com/danielsantosbr255/shipping-service/internal/gateway"
	"github.com/danielsantosbr255/shipping-service/internal/repository"
)

type ShippingActivities struct {
	carrier gateway.CarrierGateway
	repo    *repository.IdempotencyRepository
}

func NewShippingActivities(carrier gateway.CarrierGateway, repo *repository.IdempotencyRepository) *ShippingActivities {
	return &ShippingActivities{
		carrier: carrier,
		repo:    repo,
	}
}

func (a *ShippingActivities) ShipOrder(ctx context.Context, orderID string, customerID string) (err error) {
	info := activity.GetInfo(ctx)
	idempotencyKey := info.WorkflowExecution.ID + "_ship"

	if err = a.repo.RecordIdempotency(idempotencyKey); err != nil {
		if err == repository.ErrAlreadyProcessed {
			return nil // Idempotency: Already processed this orderID
		}
		return err // Temporal will retry on DB errors
	}

	defer func() {
		if err != nil {
			a.repo.DeleteIdempotency(idempotencyKey)
		}
	}()

	err = a.carrier.Dispatch(ctx, orderID, customerID)
	if err != nil {
		return err // Temporal handles retries and failures
	}

	return nil
}
