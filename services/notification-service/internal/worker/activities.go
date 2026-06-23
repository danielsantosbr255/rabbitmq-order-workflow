package worker

import (
	"context"
	"sync"

	"github.com/danielsantosbr255/notification-service/internal/gateway"
)

type NotificationActivities struct {
	email     gateway.EmailGateway
	processed sync.Map
}

func NewNotificationActivities(email gateway.EmailGateway) *NotificationActivities {
	return &NotificationActivities{
		email: email,
	}
}

func (a *NotificationActivities) NotifyCustomer(ctx context.Context, orderID string, message string) error {
	idempotencyKey := orderID + "_" + message
	if _, loaded := a.processed.LoadOrStore(idempotencyKey, true); loaded {
		return nil
	}

	err := a.email.SendEmail(ctx, "customer@example.com", "Order Update: "+orderID, message)
	if err != nil {
		a.processed.Delete(idempotencyKey)
		return err
	}
	return nil
}
