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
// ── Adapters ────────────────────────────────────────────────────────
import * as schema from "../../src/adapters/outbound/database/schema/index.js";
// ── Ports Mock ──────────────────────────────────────────────────────
import type { ISagaOrchestrator } from "../../src/application/ports/saga-orchestrator.port.js";
// ── Application ─────────────────────────────────────────────────────
import { CreateOrderUseCase } from "../../src/application/use-cases/create-order.use-case.js";
import { GetOrderUseCase } from "../../src/application/use-cases/get-order.use-case.js";

// Container image definitions for Testcontainers
const POSTGRES_IMAGE = "postgres:18-alpine";

// Helper to construct a test order payload
function buildCreateOrderPayload() {
  return {
    customerId: crypto.randomUUID(),
    items: [{ productId: crypto.randomUUID(), quantity: 1 }],
  } as const;
}

describe("OrderService E2E Integration (Testcontainers)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: pg.Client;
  let app: ReturnType<typeof Fastify>;
  let mockSaga: ISagaOrchestrator;

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

    // Mock SAGA orchestrator
    mockSaga = {
      startOrderSaga: vi.fn(async () => {}),
    };

    // Manual DI — same pattern as Composition Root
    const repository = new DrizzleOrdersRepository(db);
    const productCatalog = new MockProductCatalogAdapter();
    const createOrderUseCase = new CreateOrderUseCase(repository, productCatalog, mockSaga);
    const getOrderUseCase = new GetOrderUseCase(repository);
    const controller = new OrderController(createOrderUseCase, getOrderUseCase);

    // Bootstrap Fastify application
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(errorHandlerPlugin);

    // Inject the database connection (needed by Fastify type declaration)
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

  it("should create an order via HTTP and start SAGA via port", async () => {
    const payload = buildCreateOrderPayload();

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        "x-idempotency-key": crypto.randomUUID(),
      },
      payload,
    });

    if (response.statusCode !== 201) {
      throw new Error(`Expected 201 but got ${response.statusCode}: ${response.payload}`);
    }
    expect(response.statusCode).toBe(201);

    const body = response.json() as { orderId: string; status: string };
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("PENDING");

    // Resolve the expected price from the mock catalog
    const productCatalog = new MockProductCatalogAdapter();
    const unitPrice = await productCatalog.getProductPrice(payload.items[0]?.productId as string);

    // Verify the SAGA was triggered via port
    expect(mockSaga.startOrderSaga).toHaveBeenCalledWith(body.orderId, payload.customerId, unitPrice);
  });
});
