package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/danielsantosbr255/payment-service/internal/config"
	"github.com/danielsantosbr255/payment-service/internal/gateway"
	"github.com/danielsantosbr255/payment-service/internal/repository"
	"github.com/danielsantosbr255/payment-service/internal/worker"
)

func main() {
	// Structured JSON logging — production-ready from day one.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()
	slog.Info("payment-service starting", "rabbitmq_url", cfg.RabbitMQURL)

	// ── Connect to RabbitMQ ────────────────────────────────────────────────────
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("failed to connect to RabbitMQ", "error", err)
		os.Exit(1)
	}
	defer conn.Close()
	slog.Info("connected to RabbitMQ")

	// ── Wire dependencies (Dependency Injection) ───────────────────────────────
	repo := repository.NewMemoryRepository()
	gw := gateway.NewMockGateway()
	handler := worker.NewHandler(repo, gw, cfg.GatewayTimeoutMS)
	consumer := worker.NewConsumer(conn, handler, cfg.QOSPrefetch, cfg.MaxRetries)

	// ── Graceful Shutdown ──────────────────────────────────────────────────────
	// signal.NotifyContext cancels ctx when SIGINT or SIGTERM is received.
	// This propagates to ConsumeWithContext, which closes the delivery channel,
	// causing consumer.Run to return after all in-flight goroutines finish.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var wg sync.WaitGroup

	go func() {
		if err := consumer.Run(ctx, &wg); err != nil {
			slog.Error("consumer exited with error", "error", err)
			stop() // trigger shutdown on consumer error too
		}
	}()

	// Block until a shutdown signal is received.
	<-ctx.Done()
	slog.Info("shutdown signal received — waiting for in-flight messages to finish")

	// Wait for all goroutines processing messages to complete their current work.
	wg.Wait()

	slog.Info("all messages processed — payment-service stopped cleanly")
}
