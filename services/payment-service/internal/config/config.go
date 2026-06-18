package config

import (
	"os"
	"strconv"
)

// Config holds all environment-driven configuration for the payment worker.
type Config struct {
	// RABBITMQ_URL is the AMQP connection string.
	// Default: amqp://guest:guest@localhost:5672/
	RabbitMQURL string

	// QOS_PREFETCH controls how many unacknowledged messages the broker
	// sends to this consumer at once. Tune based on worker concurrency.
	// Default: 10
	QOSPrefetch int

	// MAX_RETRIES is the maximum number of times a message will be retried
	// via TTL wait queues before being sent to the DLQ.
	// Default: 3
	MaxRetries int

	// GATEWAY_TIMEOUT_MS is the maximum time (in milliseconds) allowed for
	// a single payment gateway call, including all retry attempts within the mock.
	// Default: 5000
	GatewayTimeoutMS int
}

// Load reads configuration from environment variables, applying sensible defaults
// for all optional values. No external dependencies — stdlib only.
func Load() Config {
	return Config{
		RabbitMQURL:      getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		QOSPrefetch:      getEnvInt("QOS_PREFETCH", 10),
		MaxRetries:       getEnvInt("MAX_RETRIES", 3),
		GatewayTimeoutMS: getEnvInt("GATEWAY_TIMEOUT_MS", 5000),
	}
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
