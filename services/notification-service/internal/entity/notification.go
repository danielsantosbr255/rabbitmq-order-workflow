package entity

// BaseEventPayload contains common fields for any order event
type BaseEventPayload struct {
	OrderID string `json:"orderId"`
}

// PaymentStatus defines the valid payment status strings
type PaymentStatus string

const (
	PaymentStatusApproved PaymentStatus = "APPROVED"
	PaymentStatusRejected PaymentStatus = "REJECTED"
)

// PaymentProcessedPayload is the payload of payment.processed event
type PaymentProcessedPayload struct {
	OrderID       string        `json:"orderId"`
	TransactionID string        `json:"transactionId"`
	Status        PaymentStatus `json:"status"`
}

// EventEnvelope is a generic envelope to read the common fields of incoming events
type EventEnvelope struct {
	EventID     string `json:"eventId"`
	EventType   string `json:"eventType"`
	AggregateID string `json:"aggregateId"`
}
