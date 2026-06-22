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

  it("should transition from PENDING to PAID", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsPaid();
    expect(order.status).toBe("PAID");
  });

  it("should transition from PAID to SHIPPED", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsPaid();
    order.markAsShipped();
    expect(order.status).toBe("SHIPPED");
  });

  it("should transition from SHIPPED to DELIVERED", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsPaid();
    order.markAsShipped();
    order.markAsDelivered();
    expect(order.status).toBe("DELIVERED");
  });

  it("should throw error if trying to complete (ship) a PENDING order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    expect(() => order.markAsShipped()).toThrow("Cannot transition from PENDING to SHIPPED");
  });

  it("should allow cancelling a PENDING order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.cancel();
    expect(order.status).toBe("CANCELED");
  });

  it("should allow cancelling a PAID order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsPaid();
    order.cancel();
    expect(order.status).toBe("CANCELED");
  });

  it("should be idempotent when cancelling a CANCELED order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.cancel();
    expect(order.status).toBe("CANCELED");
    // Chamada idempotente, não deve lançar erro
    order.cancel();
    expect(order.status).toBe("CANCELED");
  });

  it("should be idempotent when cancelling a DELIVERED order", () => {
    const order = OrderEntity.create({ customerId: crypto.randomUUID(), items: [] });
    order.markAsPaid();
    order.markAsShipped();
    order.markAsDelivered();
    expect(order.status).toBe("DELIVERED");
    order.cancel();
    expect(order.status).toBe("DELIVERED");
  });
});
