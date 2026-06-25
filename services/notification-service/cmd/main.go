package main

import (
	"log/slog"
	"os"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"

	"github.com/danielsantosbr255/notification-service/internal/gateway"
	"github.com/danielsantosbr255/notification-service/internal/repository"
	temporalWorker "github.com/danielsantosbr255/notification-service/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	slog.Info("starting notification service temporal worker")

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		slog.Error("DATABASE_URL environment variable is required")
		os.Exit(1)
	}

	repo, err := repository.NewIdempotencyRepository(dbUrl)
	if err != nil {
		slog.Error("Failed to initialize idempotency repository", "error", err)
		os.Exit(1)
	}

	emailMock := gateway.NewEmailMock()
	activities := temporalWorker.NewNotificationActivities(emailMock, repo)

	c, err := client.Dial(client.Options{
		HostPort: os.Getenv("TEMPORAL_ADDRESS"),
	})
	if err != nil {
		slog.Error("Unable to create Temporal client", "error", err)
		os.Exit(1)
	}
	defer c.Close()

	w := worker.New(c, "notification-service-task-queue", worker.Options{})
	w.RegisterActivity(activities.NotifyCustomer)

	slog.Info("notification-service starting Temporal worker on notification-service-task-queue")
	err = w.Start()
	if err != nil {
		slog.Error("Unable to start Temporal worker", "error", err)
		os.Exit(1)
	}

	slog.Info("Started Worker", "Namespace", "default", "TaskQueue", "notification-service-task-queue")
	select {}
}
