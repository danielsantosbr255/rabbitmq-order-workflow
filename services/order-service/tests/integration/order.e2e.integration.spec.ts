import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OrderController } from "../../src/adapters/inbound/http/fastify/controllers/order.controller.js";
import errorHandlerPlugin from "../../src/adapters/inbound/http/fastify/plugins/error-handler.plugin.js";
import { orderRoutes } from "../../src/adapters/inbound/http/fastify/routes/order.routes.js";
import { MockProductCatalogAdapter } from "../../src/adapters/outbound/catalog/mock-product-catalog.adapter.js";
import { DrizzleOrdersRepository } from "../../src/adapters/outbound/database/repositories/drizzle-order.repository.js";
import * as schema from "../../src/adapters/outbound/database/schema/index.js";
import type { ISagaOrchestrator } from "../../src/application/ports/saga-orchestrator.port.js";
import { CreateOrderUseCase } from "../../src/application/use-cases/create-order.use-case.js";
import { GetOrderUseCase } from "../../src/application/use-cases/get-order.use-case.js";

const POSTGRES_IMAGE = "postgres:18-alpine";

describe("OrderService E2E Integration (Testcontainers)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: pg.Client;
  let app: ReturnType<typeof Fastify>;
  let mockSaga: ISagaOrchestrator;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    pgClient = new pg.Client({ connectionString: pgContainer.getConnectionUri() });

    await pgClient.connect();
    await pgClient.query(`
      CREATE TABLE orders (
        id UUID PRIMARY KEY,
        customer_id UUID NOT NULL,
        items JSONB NOT NULL,
        total_amount INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
      CREATE TABLE idempotency_keys (
        key UUID PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES orders(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    const db = drizzle(pgClient, { schema });

    mockSaga = { startOrderSaga: vi.fn(async () => ({ isNew: true })) };

    const productCatalog = new MockProductCatalogAdapter();
    const createOrderUseCase = new CreateOrderUseCase(productCatalog, mockSaga);
    const repository = new DrizzleOrdersRepository(db);
    const getOrderUseCase = new GetOrderUseCase(repository);
    const controller = new OrderController(createOrderUseCase, getOrderUseCase);

    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(errorHandlerPlugin);

    app.decorate("db", db);

    app.register(orderRoutes(controller), { prefix: "/orders" });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await pgClient?.end();
    await pgContainer?.stop();
    vi.restoreAllMocks();
  });

  it("should verify Postgres container is running and accessible", async () => {
    const result = await pgClient.query("SELECT 1 AS ready");
    expect(result.rows[0]?.ready).toBe(1);
  });

  it("should accept an order via HTTP and start SAGA via port", async () => {
    const payload = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    };

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        "x-idempotency-key": crypto.randomUUID(),
      },
      payload,
    });

    if (response.statusCode !== 202) {
      throw new Error(`Expected 202 but got ${response.statusCode}: ${response.payload}`);
    }
    expect(response.statusCode).toBe(202);

    const body = response.json() as { orderId: string; status: string };
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("ACCEPTED");

    // Verify the SAGA was triggered via port with the serialized order data
    expect(mockSaga.startOrderSaga).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: body.orderId,
        customerId: payload.customerId,
      }),
    );
  });
});
