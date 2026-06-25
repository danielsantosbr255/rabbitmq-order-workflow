package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var ErrAlreadyProcessed = errors.New("already processed")

type IdempotencyRepository struct {
	db *sql.DB
}

func NewIdempotencyRepository(dbUrl string) (*IdempotencyRepository, error) {
	db, err := sql.Open("pgx", dbUrl)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Auto-migrate
	schema := `
	CREATE SCHEMA IF NOT EXISTS shipping_schema;
	CREATE TABLE IF NOT EXISTS shipping_schema.processed_events (
		idempotency_key VARCHAR(255) PRIMARY KEY,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err = db.Exec(schema)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate shipping schema: %w", err)
	}

	return &IdempotencyRepository{db: db}, nil
}

func (r *IdempotencyRepository) RecordIdempotency(key string) error {
	_, err := r.db.Exec("INSERT INTO shipping_schema.processed_events (idempotency_key) VALUES ($1)", key)
	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			return ErrAlreadyProcessed
		}
		return err
	}
	return nil
}

func (r *IdempotencyRepository) DeleteIdempotency(key string) error {
	_, err := r.db.Exec("DELETE FROM shipping_schema.processed_events WHERE idempotency_key = $1", key)
	return err
}
