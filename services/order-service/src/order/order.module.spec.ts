import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { Connection } from "rabbitmq-client";
import { describe, expect, it, vi } from "vitest";
import errorHandlerPlugin from "../plugins/error-handler.plugin.js";
import { OrderModule } from "./order.module.js";

const mockRabbitConnection = {
  createPublisher: vi.fn(() => ({
    send: vi.fn(async () => {}),
    close: vi.fn(),
  })),
};

describe("OrderModule Integration Tests", () => {
  const buildApp = () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(errorHandlerPlugin);

    app.decorate("rabbit", mockRabbitConnection as unknown as Connection);

    app.register(OrderModule, { prefix: "/orders" });
    return app;
  };

  it("should create an order and return 201 (POST /orders)", async () => {
    const app = buildApp();
    const payload = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 3 }],
    };

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("PENDING");
  });

  it("should return 400 if payload is invalid (POST /orders)", async () => {
    const app = buildApp();
    const payload = {
      customerId: crypto.randomUUID(),
      items: [], // empty items array should fail validation
    };

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it("should retrieve an existing order by id (GET /orders/:id)", async () => {
    const app = buildApp();
    const payload = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    };

    // 1. Create order
    const createRes = await app.inject({
      method: "POST",
      url: "/orders",
      payload,
    });
    const { orderId } = createRes.json();

    // 2. Fetch order
    const getRes = await app.inject({
      method: "GET",
      url: `/orders/${orderId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.id).toBe(orderId);
    expect(getBody.customerId).toBe(payload.customerId);
    expect(getBody.items).toEqual(payload.items);
    expect(getBody.status).toBe("PENDING");
  });

  it("should return 404 for non-existent order (GET /orders/:id)", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/orders/${crypto.randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
  });
});
