package repository

import (
	"errors"
	"sync"

	"github.com/danielsantosbr255/payment-service/internal/entity"
)

type MemoryRepository struct {
	mu   sync.RWMutex
	data map[string]entity.Payment
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		data: make(map[string]entity.Payment),
	}
}

func (r *MemoryRepository) GetPaymentByOrderID(orderID string) (entity.Payment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if payment, exists := r.data[orderID]; exists {
		return payment, nil
	}
	return entity.Payment{}, errors.New("payment not found")
}

func (r *MemoryRepository) Save(p entity.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.data[p.OrderID]; !exists {
		r.data[p.OrderID] = p
	}
	return nil
}
