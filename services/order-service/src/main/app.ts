import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { drizzle } from "drizzle-orm/node-postgres";
import fastify from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import pg from "pg";
import { OrderController } from "../adapters/inbound/http/fastify/controllers/order.controller.js";
import errorHandlerPlugin from "../adapters/inbound/http/fastify/plugins/error-handler.plugin.js";
import { orderRoutes } from "../adapters/inbound/http/fastify/routes/order.routes.js";
import { MockProductCatalogAdapter } from "../adapters/outbound/catalog/mock-product-catalog.adapter.js";
import databasePlugin from "../adapters/outbound/database/drizzle.plugin.js";
import { DrizzleOrdersRepository } from "../adapters/outbound/database/repositories/drizzle-order.repository.js";
import * as schema from "../adapters/outbound/database/schema/index.js";
import { TemporalSagaAdapter } from "../adapters/outbound/temporal/temporal-saga.adapter.js";
import { CreateOrderUseCase } from "../application/use-cases/create-order.use-case.js";
import { GetOrderUseCase } from "../application/use-cases/get-order.use-case.js";
import { env } from "./config/env.js";

export const buildApp = async () => {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  try {
    const client = await pool.connect();
    client.release();
  } catch (error) {
    console.error("Failed to connect to PostgreSQL", error);
    throw error;
  }

  const db = drizzle(pool, { schema });

  const sagaAdapter = await TemporalSagaAdapter.createAndConnect(env.TEMPORAL_ADDRESS);

  const app = fastify({
    logger:
      env.NODE_ENV === "production"
        ? { level: "info" }
        : {
            level: "debug",
            transport: {
              target: "pino-pretty",
              options: { singleLine: true, colorize: true },
            },
          },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandlerPlugin);

  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(databasePlugin, { pool, db });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Order Service API",
        description: "API for managing orders",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  const repository = new DrizzleOrdersRepository(db);
  const productCatalog = new MockProductCatalogAdapter();
  const createOrderUseCase = new CreateOrderUseCase(repository, productCatalog, sagaAdapter);
  const getOrderUseCase = new GetOrderUseCase(repository);
  const controller = new OrderController(createOrderUseCase, getOrderUseCase);

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(orderRoutes(controller), { prefix: "/orders" });

  return app;
};
