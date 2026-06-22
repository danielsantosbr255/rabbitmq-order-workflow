package config

import (
	"fmt"
	"os"
	"strconv"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Config holds all environment-driven configuration for the shipping worker.
type Config struct {
	RabbitMQURL      string
	QOSPrefetch      int
	MaxRetries       int
}

// Load reads configuration from environment variables
func Load() Config {
	return Config{
		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		QOSPrefetch: getEnvInt("QOS_PREFETCH", 10),
		MaxRetries:  getEnvInt("MAX_RETRIES", 3),
	}
}

// Connect establishes a connection to RabbitMQ
func Connect(url string) (*amqp.Connection, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}
	return conn, nil
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultValue
	}
	return n
}
