import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import pg from "pg";
import { Connection } from "rabbitmq-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderPlacedEvent } from "../../src/order/order.events.js";
import { OrderModule } from "../../src/order/order.module.js";
import errorHandlerPlugin from "../../src/plugins/error-handler.plugin.js";

describe("OrderService E2E Integration (Testcontainers)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: pg.Client;
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbit: Connection;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    // 1. Start PostgreSQL 18 alpine container
    pgContainer = await new PostgreSqlContainer("postgres:18-alpine").start();
    pgClient = new pg.Client({ connectionString: pgContainer.getConnectionUri() });
    await pgClient.connect();

    // 2. Start RabbitMQ container with explicit credentials
    rabbitContainer = await new RabbitMQContainer("rabbitmq:4.3-management-alpine")
      .withEnvironment({ RABBITMQ_DEFAULT_USER: "test", RABBITMQ_DEFAULT_PASS: "test" })
      .start();

    const amqpUrl = rabbitContainer.getAmqpUrl().replace("amqp://", "amqp://test:test@");
    rabbit = new Connection({ url: amqpUrl });

    // 3. Setup Fastify app
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(errorHandlerPlugin);

    // Inject the real rabbit connection instead of mock
    app.decorate("rabbit", rabbit);

    app.register(OrderModule, { prefix: "/orders" });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await rabbit?.close();
    await rabbitContainer?.stop();
    await pgClient?.end();
    await pgContainer?.stop();
  });

  it("should verify Postgres container is running and accessible", async () => {
    const result = await pgClient.query("SELECT 1 AS ready");
    expect(result.rows[0].ready).toBe(1);
  });

  it("should create an order successfully via HTTP and publish to RabbitMQ", async () => {
    const payload = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    };

    // Prepare a consumer to listen for the event
    let receivedMessage: OrderPlacedEvent | null = null;
    const consumer = rabbit.createConsumer(
      {
        queue: "test-order-placed",
        queueOptions: { autoDelete: true, exclusive: true },
        exchanges: [{ exchange: "orders", type: "topic" }],
        queueBindings: [{ exchange: "orders", routingKey: "order.placed" }],
      },
      async msg => {
        receivedMessage = msg.body;
      },
    );

    // Wait a brief moment to ensure queue is bound before publishing
    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("PENDING");

    // Wait for the message to arrive (with a timeout)
    let attempts = 0;
    while (!receivedMessage && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    const msg = receivedMessage as OrderPlacedEvent | null;
    expect(msg).toBeDefined();
    if (!msg) throw new Error("Message not received");
    expect(msg.payload.customerId).toBe(payload.customerId);
    expect(msg.payload.orderId).toBe(body.orderId);

    await consumer.close();
  });
});
