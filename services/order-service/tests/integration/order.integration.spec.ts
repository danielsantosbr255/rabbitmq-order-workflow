import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type IntegrationTestEnvironment, setupTestEnvironment } from "../utils/setup.js";
import { waitForOrderStatus } from "../utils/wait.js";

describe("OrderService E2E Integration (Testcontainers)", () => {
  let env: IntegrationTestEnvironment;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  });

  afterAll(async () => {
    await env.teardown();
    vi.restoreAllMocks();
  });

  it("should verify Postgres container is running and accessible", async () => {
    const result = await env.pgClient.query("SELECT 1 AS ready");
    expect(result.rows[0]?.ready).toBe(1);
  });

  it("Scenario 1: Happy Path - Order should go from PENDING to SHIPPED", async () => {
    const customerId = "00000000-0000-4000-8000-000000000003";
    const payload = {
      customerId,
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    };

    const response = await env.app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        "x-idempotency-key": crypto.randomUUID(),
      },
      payload,
    });

    expect(response.statusCode).toBe(202);

    const body = response.json() as { orderId: string; status: string };
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("ACCEPTED");

    // Poll until Temporal orchestration completes
    const fetchOrderFn = async () => {
      const res = await env.app.inject({ method: "GET", url: `/orders/${body.orderId}` });
      return res.statusCode === 200 ? (res.json() as { status: string }) : null;
    };
    const completedOrder = await waitForOrderStatus(fetchOrderFn, "SHIPPED");
    expect(completedOrder.status).toBe("SHIPPED");

    // Verify the SAGA successfully updated the order in Postgres
    const finalOrder = await env.pgClient.query("SELECT status FROM orders WHERE id = $1", [body.orderId]);
    expect(finalOrder.rows[0]?.status).toBe("SHIPPED");
  });

  it("Scenario 2: Compensation - Payment Failure should CANCEL the order", async () => {
    const customerId = "00000000-0000-4000-8000-000000000001";
    const payload = { customerId, items: [{ productId: crypto.randomUUID(), quantity: 1 }] };

    const response = await env.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "x-idempotency-key": crypto.randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as { orderId: string };

    const fetchOrderFn = async () => {
      const res = await env.app.inject({ method: "GET", url: `/orders/${body.orderId}` });
      return res.statusCode === 200 ? (res.json() as { status: string }) : null;
    };
    const completedOrder = await waitForOrderStatus(fetchOrderFn, "CANCELED");
    expect(completedOrder.status).toBe("CANCELED");
  });

  it("Scenario 3: Compensation - Shipping Failure should CANCEL the order", async () => {
    const customerId = "00000000-0000-4000-8000-000000000002";
    const payload = { customerId, items: [{ productId: crypto.randomUUID(), quantity: 1 }] };

    const response = await env.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "x-idempotency-key": crypto.randomUUID() },
      payload,
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as { orderId: string };

    const fetchOrderFn = async () => {
      const res = await env.app.inject({ method: "GET", url: `/orders/${body.orderId}` });
      return res.statusCode === 200 ? (res.json() as { status: string }) : null;
    };
    const completedOrder = await waitForOrderStatus(fetchOrderFn, "CANCELED");
    expect(completedOrder.status).toBe("CANCELED");
  });

  it("Scenario 4: Idempotency - Same idempotency key should return existing order", async () => {
    const customerId = "00000000-0000-4000-8000-000000000003";
    const idempotencyKey = crypto.randomUUID();
    const payload = { customerId, items: [{ productId: crypto.randomUUID(), quantity: 1 }] };

    const createRes1 = await env.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "x-idempotency-key": idempotencyKey },
      payload,
    });
    expect(createRes1.statusCode).toBe(202);
    const body1 = createRes1.json() as { orderId: string };

    const fetchOrderFn = async () => {
      const res = await env.app.inject({ method: "GET", url: `/orders/${body1.orderId}` });
      return res.statusCode === 200 ? (res.json() as { status: string }) : null;
    };
    await waitForOrderStatus(fetchOrderFn, "SHIPPED");

    const createRes2 = await env.app.inject({
      method: "POST",
      url: "/orders",
      headers: { "x-idempotency-key": idempotencyKey },
      payload,
    });
    expect(createRes2.statusCode).toBe(200);
    const body2 = createRes2.json() as { orderId: string; status: string };

    expect(body2.orderId).toBe(body1.orderId);
    expect(body2.status).toBe("SHIPPED");
  });
});
