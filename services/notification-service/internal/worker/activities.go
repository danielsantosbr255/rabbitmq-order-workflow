package worker

import (
	"context"

	"go.temporal.io/sdk/activity"

	"github.com/danielsantosbr255/notification-service/internal/gateway"
	"github.com/danielsantosbr255/notification-service/internal/repository"
)

type NotificationActivities struct {
	email gateway.EmailGateway
	repo  *repository.IdempotencyRepository
}

func NewNotificationActivities(email gateway.EmailGateway, repo *repository.IdempotencyRepository) *NotificationActivities {
	return &NotificationActivities{
		email: email,
		repo:  repo,
	}
}

func (a *NotificationActivities) NotifyCustomer(ctx context.Context, orderID string, message string) error {
	info := activity.GetInfo(ctx)
	idempotencyKey := info.WorkflowExecution.ID + "_" + message

	if err := a.repo.RecordIdempotency(idempotencyKey); err != nil {
		if err == repository.ErrAlreadyProcessed {
			return nil
		}
		return err
	}

	err := a.email.SendEmail(ctx, "customer@example.com", "Order Update: "+orderID, message)
	if err != nil {
		return err
	}
	return nil
}
