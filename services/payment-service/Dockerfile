# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Download dependencies first (cached layer if go.mod/go.sum unchanged)
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build a statically linked binary — no libc needed in the final image.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /worker ./cmd/main.go

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.22

# Non-root user for security best practices.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /worker /worker

USER appuser

# The worker has no exposed ports — it only connects outbound to RabbitMQ.
CMD ["/worker"]
