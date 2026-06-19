import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import pg from "pg";
import { Connection } from "rabbitmq-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../src/infra/database/schema.js";
import type { OrderPlacedEvent } from "../../src/order/order.events.js";
import { OrderModule } from "../../src/order/order.module.js";
import errorHandlerPlugin from "../../src/plugins/error-handler.plugin.js";

// Container image definitions for Testcontainers
const POSTGRES_IMAGE = "postgres:18-alpine";
const RABBITMQ_IMAGE = "rabbitmq:4.3-management-alpine";

const RABBIT_USER = "test";
const RABBIT_PASS = "test";
const EXCHANGE_NAME = "orders";
const ROUTING_KEY = "order.placed";

// Helper to construct a test order payload
function buildCreateOrderPayload() {
  return {
    customerId: crypto.randomUUID(),
    items: [{ productId: crypto.randomUUID(), quantity: 1 }],
  } as const;
}

// Helper to build AMQP connection URL with credentials
function buildAmqpUrl(container: StartedRabbitMQContainer): string {
  const host = container.getHost();
  const port = container.getMappedPort(5672);
  return `amqp://${RABBIT_USER}:${RABBIT_PASS}@${host}:${port}`;
}

describe("OrderService E2E Integration (Testcontainers)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: pg.Client;
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbit: Connection;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    // Spin up real database instance via Testcontainers
    pgContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

    // Connect real Postgres client to the container
    pgClient = new pg.Client({ connectionString: pgContainer.getConnectionUri() });
    await pgClient.connect();

    // Create the schema
    await pgClient.query(`
      CREATE TABLE orders (
        id UUID PRIMARY KEY,
        customer_id UUID NOT NULL,
        items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      CREATE TABLE outbox (
        id UUID PRIMARY KEY,
        aggregate_type VARCHAR(50) NOT NULL,
        aggregate_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        processed BOOLEAN DEFAULT FALSE NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE
      );
    `);

    const db = drizzle(pgClient, { schema });

    // Spin up real message broker instance via Testcontainers
    rabbitContainer = await new RabbitMQContainer(RABBITMQ_IMAGE)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: RABBIT_USER,
        RABBITMQ_DEFAULT_PASS: RABBIT_PASS,
      })
      .start();

    // Connect to the Testcontainers RabbitMQ instance
    rabbit = new Connection({ url: buildAmqpUrl(rabbitContainer) });

    // Bootstrap Fastify application
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(errorHandlerPlugin);

    // Inject the database and broker connection dependencies
    app.decorate("db", db);
    app.decorate("rabbit", rabbit);

    // Register routes and wait for the application to be fully ready
    app.register(OrderModule, { prefix: "/orders" });
    await app.ready();
  });

  afterAll(async () => {
    // Teardown services in reverse order of initialization
    await app?.close();
    await rabbit?.close();
    await pgClient?.end();
    await rabbitContainer?.stop();
    await pgContainer?.stop();
  });

  it("should verify Postgres container is running and accessible", async () => {
    const result = await pgClient.query("SELECT 1 AS ready");
    expect(result.rows[0]?.ready).toBe(1);
  });

  it("should create an order via HTTP and publish an OrderPlaced event to RabbitMQ", async () => {
    const payload = buildCreateOrderPayload();
    let receivedEvent: OrderPlacedEvent | null = null;

    // Listen to the broker for the expected integration event
    const consumer = rabbit.createConsumer(
      {
        queue: "test-order-placed",
        queueOptions: { autoDelete: true, exclusive: true },
        exchanges: [{ exchange: EXCHANGE_NAME, type: "topic", durable: true }],
        queueBindings: [{ exchange: EXCHANGE_NAME, routingKey: ROUTING_KEY }],
      },
      async msg => {
        receivedEvent = msg.body as OrderPlacedEvent;
      },
    );

    try {
      // Small pause to guarantee broker bindings are active before request
      await new Promise(resolve => setTimeout(resolve, 500));

      // Execute HTTP request using Fastify's in-memory light-my-request
      const response = await app.inject({
        method: "POST",
        url: "/orders",
        payload,
      });

      expect(response.statusCode).toBe(201);

      const body = response.json() as { orderId: string; status: string };
      expect(body.orderId).toBeDefined();
      expect(body.status).toBe("PENDING");

      // Wait for the async consumer to capture the event published by the service
      await vi.waitFor(
        () => {
          expect(receivedEvent).toBeDefined();
          expect(receivedEvent?.payload.customerId).toBe(payload.customerId);
          expect(receivedEvent?.payload.orderId).toBe(body.orderId);
        },
        { interval: 100, timeout: 3_000 },
      );
    } finally {
      // Ensure the test consumer is closed to avoid resource leaks
      await consumer.close();
    }
  });
});
