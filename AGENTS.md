# AGENTS.md — rabbitmq-order-workflow

## Stack

- **Runtime:** Node.js 24 (Alpine) — all services use `FROM node:24-alpine`
- **Messaging:** RabbitMQ (project name implies amqplib or rascal for pub/sub)
- **5 microservices** under `services/`:
  - `order-service` — orchestrator
  - `payment-service`
  - `inventory-service`
  - `shipping-service`
  - `notification-service`

## State (greenfield)

No application code, no `package.json`, no test/lint/build config, no `.gitignore`, no `compose.yaml` content. `README.md` is a stub. All files are placeholders that need to be built out.

## Workflow conventions

- Run everything locally via `docker compose up` — populate `compose.yaml` with RabbitMQ + all 5 services.
- Each service should ship its own `Dockerfile` (already stubbed).
- Add `.gitignore` before first `npm install` (no `node_modules/` in git).
- No test/lint framework chosen yet — pick one and document here once set up.
