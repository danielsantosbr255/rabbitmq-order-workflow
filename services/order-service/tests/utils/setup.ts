import { Client, Connection } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import { ApplicationFailure } from "@temporalio/workflow";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import pg from "pg";
import { GenericContainer, Network } from "testcontainers";
import { OrderController } from "../../src/adapters/inbound/http/fastify/controllers/order.controller.js";
import errorHandlerPlugin from "../../src/adapters/inbound/http/fastify/plugins/error-handler.plugin.js";
import { orderRoutes } from "../../src/adapters/inbound/http/fastify/routes/order.routes.js";
import { MockProductCatalogAdapter } from "../../src/adapters/outbound/catalog/mock-product-catalog.adapter.js";
import { DrizzleOrdersRepository } from "../../src/adapters/outbound/database/repositories/drizzle-order.repository.js";
import * as schema from "../../src/adapters/outbound/database/schema/index.js";
import { createActivities } from "../../src/adapters/outbound/temporal/activities.js";
import { TemporalSagaAdapter } from "../../src/adapters/outbound/temporal/temporal-saga.adapter.js";
import { CreateOrderUseCase } from "../../src/application/use-cases/create-order.use-case.js";
import { GetOrderUseCase } from "../../src/application/use-cases/get-order.use-case.js";
import { UpdateOrderStatusUseCase } from "../../src/application/use-cases/update-order-status.use-case.js";

const POSTGRES_IMAGE = "postgres:18-alpine";
const TEMPORAL_IMAGE = "temporalio/auto-setup:1.24.2";

export interface IntegrationTestEnvironment {
  app: ReturnType<typeof Fastify>;
  pgClient: pg.Client;
  teardown: () => Promise<void>;
}

export async function setupTestEnvironment(): Promise<IntegrationTestEnvironment> {
  const network = await new Network().start();

  const pgContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withNetworkMode(network.getName())
    .withNetworkAliases("postgres")
    .start();

  const temporalContainer = await new GenericContainer(TEMPORAL_IMAGE)
    .withNetworkMode(network.getName())
    .withExposedPorts(7233)
    .withEnvironment({
      DB: "postgres12",
      DB_PORT: "5432",
      POSTGRES_USER: pgContainer.getUsername(),
      POSTGRES_PWD: pgContainer.getPassword(),
      POSTGRES_SEEDS: "postgres",
      POSTGRES_OPTS: "?sslmode=disable",
      DYNAMIC_CONFIG_LIMITS_MAX_VISIBILITY_TIMEOUT_MILLIS: "1000",
    })
    .start();

  const pgClient = new pg.Client({ connectionString: pgContainer.getConnectionUri() });
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
  const productCatalog = new MockProductCatalogAdapter();
  const repository = new DrizzleOrdersRepository(db);

  const temporalPort = temporalContainer.getMappedPort(7233);
  const temporalConnection = await Connection.connect({ address: `localhost:${temporalPort}` });
  const client = new Client({ connection: temporalConnection });
  const sagaAdapter = TemporalSagaAdapter.create(client);

  const temporalNativeConnection = await NativeConnection.connect({ address: `localhost:${temporalPort}` });
  const updateUseCase = new UpdateOrderStatusUseCase(repository);

  const orderWorker = await Worker.create({
    connection: temporalNativeConnection,
    namespace: "default",
    taskQueue: "order-saga-task-queue",
    workflowsPath: new URL("../../src/main/workflows-loader.ts", import.meta.url).pathname,
    activities: createActivities(updateUseCase, repository),
  });

  const paymentWorker = await Worker.create({
    connection: temporalNativeConnection,
    namespace: "default",
    taskQueue: "payment-service-task-queue",
    activities: {
      ProcessPayment: async (_orderId: string, customerId: string) => {
        if (customerId === "00000000-0000-4000-8000-000000000001") {
          throw ApplicationFailure.nonRetryable("Simulated payment decline for testing");
        }
      },
      RefundPayment: async () => {},
    },
  });

  const shippingWorker = await Worker.create({
    connection: temporalNativeConnection,
    namespace: "default",
    taskQueue: "shipping-service-task-queue",
    activities: {
      ShipOrder: async (_orderId: string, customerId: string) => {
        if (customerId === "00000000-0000-4000-8000-000000000002") {
          throw ApplicationFailure.nonRetryable("Simulated shipping failure for testing");
        }
      },
    },
  });

  const notificationWorker = await Worker.create({
    connection: temporalNativeConnection,
    namespace: "default",
    taskQueue: "notification-service-task-queue",
    activities: {
      NotifyCustomer: async () => {},
    },
  });

  const workers = [orderWorker, paymentWorker, shippingWorker, notificationWorker];
  const workerRunPromises = workers.map(w => w.run().catch(() => {}));

  const createOrderUseCase = new CreateOrderUseCase(productCatalog, sagaAdapter, repository);
  const getOrderUseCase = new GetOrderUseCase(repository);
  const controller = new OrderController(createOrderUseCase, getOrderUseCase);

  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(errorHandlerPlugin);
  app.decorate("db", db);
  app.register(orderRoutes(controller), { prefix: "/orders" });
  await app.ready();

  const teardown = async () => {
    for (const w of workers) {
      w.shutdown();
    }
    await Promise.all(workerRunPromises);
    await temporalNativeConnection?.close();
    await temporalConnection?.close();
    await temporalContainer?.stop();
    await app?.close();
    await pgClient?.end();
    await pgContainer?.stop();
    await network?.stop();
  };

  return { app, pgClient, teardown };
}
