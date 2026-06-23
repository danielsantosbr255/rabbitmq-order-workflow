package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/danielsantosbr255/notification-service/internal/config"
	"github.com/danielsantosbr255/notification-service/internal/gateway"
	"github.com/danielsantosbr255/notification-service/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := config.Load()

	slog.Info("starting notification service...")

	conn, err := config.Connect(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("failed to connect to RabbitMQ", "error", err)
		os.Exit(1)
	}
	defer conn.Close()

	emailMock := gateway.NewEmailMock()
	handler := worker.NewHandler(emailMock)
	consumer := worker.NewConsumer(conn, handler)

	if err := consumer.SetupTopology(); err != nil {
		slog.Error("failed to setup topology", "error", err)
		os.Exit(1)
	}

	if err := consumer.Start(cfg.QOSPrefetch); err != nil {
		slog.Error("failed to start consumer", "error", err)
		os.Exit(1)
	}

	slog.Info("service is running. press Ctrl+C to stop.")

	// Wait for termination signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	slog.Info("shutting down gracefully...")
	consumer.Stop()
	slog.Info("shutdown complete")
}
