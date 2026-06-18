package repository

import (
	"sync"

	"github.com/danielsantosbr255/payment-service/internal/entity"
)

// MemoryRepository is a thread-safe in-memory implementation of PaymentRepository.
// It is suitable for development and demo purposes.
// Replace with a database-backed adapter (e.g., PostgreSQL via pgx) when
// persistence across restarts is required.
type MemoryRepository struct {
	mu   sync.RWMutex
	data map[string]entity.Payment
}

// NewMemoryRepository initialises an empty MemoryRepository.
func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		data: make(map[string]entity.Payment),
	}
}

// HasPaymentForOrder implements PaymentRepository.
// Uses a read lock so concurrent goroutines can query without blocking each other.
func (r *MemoryRepository) HasPaymentForOrder(orderID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.data[orderID]
	return exists
}

// Save implements PaymentRepository.
// Uses a write lock. If the order ID already exists the existing record is kept
// (first-writer wins) to guarantee idempotency even under concurrent processing.
func (r *MemoryRepository) Save(p entity.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.data[p.OrderID]; !exists {
		r.data[p.OrderID] = p
	}
	return nil
}
