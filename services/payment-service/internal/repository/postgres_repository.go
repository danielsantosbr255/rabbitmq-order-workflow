package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/danielsantosbr255/payment-service/internal/entity"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var ErrAlreadyProcessed = errors.New("already processed")

type PostgresPaymentRepository struct {
	db *sql.DB
}

func NewPostgresPaymentRepository(dbUrl string) (*PostgresPaymentRepository, error) {
	db, err := sql.Open("pgx", dbUrl)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Auto-migrate
	schema := `
	CREATE SCHEMA IF NOT EXISTS payment_schema;
	CREATE TABLE IF NOT EXISTS payment_schema.payments (
		order_id VARCHAR(255) PRIMARY KEY,
		transaction_id VARCHAR(255),
		status VARCHAR(50),
		processed_at TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS payment_schema.processed_events (
		idempotency_key VARCHAR(255) PRIMARY KEY,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err = db.Exec(schema)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	return &PostgresPaymentRepository{db: db}, nil
}

func (r *PostgresPaymentRepository) GetPaymentByOrderID(orderID string) (entity.Payment, error) {
	var p entity.Payment
	err := r.db.QueryRow("SELECT order_id, transaction_id, status, processed_at FROM payment_schema.payments WHERE order_id = $1", orderID).
		Scan(&p.OrderID, &p.TransactionID, &p.Status, &p.ProcessedAt)
	if err != nil {
		return p, err // sql.ErrNoRows will be returned if not found
	}
	return p, nil
}

func (r *PostgresPaymentRepository) Save(p entity.Payment) error {
	_, err := r.db.Exec(`
		INSERT INTO payment_schema.payments (order_id, transaction_id, status, processed_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (order_id) DO UPDATE
		SET status = EXCLUDED.status, transaction_id = EXCLUDED.transaction_id, processed_at = EXCLUDED.processed_at
	`, p.OrderID, p.TransactionID, p.Status, p.ProcessedAt)
	return err
}

func (r *PostgresPaymentRepository) RecordIdempotency(key string) error {
	_, err := r.db.Exec("INSERT INTO payment_schema.processed_events (idempotency_key) VALUES ($1)", key)
	if err != nil {
		// pgx returns error containing "23505" for unique constraint violation
		if strings.Contains(err.Error(), "23505") {
			return ErrAlreadyProcessed
		}
		return err
	}
	return nil
}
