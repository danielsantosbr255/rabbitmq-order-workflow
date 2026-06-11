import { describe, expect, it } from "vitest";
import { OrderEntity } from "./order.entity.js";

describe("OrderEntity", () => {
  it("should create a valid order with PENDING status", () => {
    const input = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    };

    const order = OrderEntity.create(input);

    expect(order.id).toBeDefined();
    expect(order.customerId).toBe(input.customerId);
    expect(order.items).toEqual(input.items);
    expect(order.status).toBe("PENDING");
  });

  it("should transition from PENDING to PROCESSING", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsProcessing();
    expect(order.status).toBe("PROCESSING");
  });

  it("should transition from PROCESSING to COMPLETED", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsProcessing();
    order.complete();
    expect(order.status).toBe("COMPLETED");
  });

  it("should throw error if trying to complete a PENDING order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    expect(() => order.complete()).toThrow("Cannot transition from PENDING to COMPLETED");
  });

  it("should allow cancelling a PENDING order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.cancel();
    expect(order.status).toBe("CANCELLED");
  });

  it("should allow cancelling a PROCESSING order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsProcessing();
    order.cancel();
    expect(order.status).toBe("CANCELLED");
  });

  it("should throw error if trying to cancel a COMPLETED order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsProcessing();
    order.complete();
    expect(() => order.cancel()).toThrow("Cannot transition from COMPLETED to CANCELLED");
  });
});
