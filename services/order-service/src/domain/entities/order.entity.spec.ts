import { describe, expect, it } from "vitest";
import { OrderEntity } from "./order.entity.js";

function validCreateInput(
  overrides?: Partial<{ customerId: string; items: { productId: string; quantity: number; unitPrice: number }[] }>,
) {
  return {
    customerId: overrides?.customerId ?? crypto.randomUUID(),
    items: overrides?.items ?? [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 100 }],
  };
}

describe("OrderEntity", () => {
  describe("create()", () => {
    it("should create a valid order with PENDING status", () => {
      const input = validCreateInput();
      const order = OrderEntity.create(input);

      expect(order.id).toBeDefined();
      expect(order.customerId).toBe(input.customerId);
      expect(order.status).toBe("PENDING");
      expect(order.totalAmount.cents).toBe(100);
      expect(order.items).toHaveLength(1);
      expect(order.items[0]?.productId).toBe(input.items[0]?.productId);
    });

    it("should calculate totalAmount correctly with multiple items", () => {
      const order = OrderEntity.create({
        customerId: crypto.randomUUID(),
        items: [
          { productId: crypto.randomUUID(), quantity: 2, unitPrice: 5000 },
          { productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 },
        ],
      });

      expect(order.totalAmount.cents).toBe(11500); // (2 * 5000) + (1 * 1500)
    });

    it("should throw if customerId is not a valid UUID", () => {
      expect(() => OrderEntity.create(validCreateInput({ customerId: "invalid" }))).toThrow("valid UUID");
    });

    it("should throw if items array is empty", () => {
      expect(() => OrderEntity.create(validCreateInput({ items: [] }))).toThrow("at least one item");
    });
  });

  describe("restore()", () => {
    it("should restore an order from persistence data", () => {
      const id = crypto.randomUUID();
      const customerId = crypto.randomUUID();
      const now = new Date().toISOString();

      const order = OrderEntity.restore({
        id,
        customerId,
        items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 100 }],
        totalAmount: 100,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      });

      expect(order.id).toBe(id);
      expect(order.customerId).toBe(customerId);
      expect(order.status).toBe("PENDING");
      expect(order.totalAmount.cents).toBe(100);
    });

    it("should throw if status is invalid", () => {
      expect(() =>
        OrderEntity.restore({
          id: crypto.randomUUID(),
          customerId: crypto.randomUUID(),
          items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 100 }],
          totalAmount: 100,
          // biome-ignore lint/suspicious/noExplicitAny: testing runtime validation
          status: "INVALID_STATUS" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ).toThrow("invalid status");
    });
  });

  describe("State Transitions (Idempotency)", () => {
    it("markAsPaid should be idempotent", () => {
      const order = OrderEntity.create(validCreateInput());

      order.markAsPaid();
      expect(order.status).toBe("PAID");

      // Second call should not throw
      expect(() => order.markAsPaid()).not.toThrow();
      expect(order.status).toBe("PAID");
    });

    it("markAsShipped should be idempotent", () => {
      const order = OrderEntity.create(validCreateInput());

      order.markAsPaid();
      order.markAsShipped();
      expect(order.status).toBe("SHIPPED");

      // Second call should not throw
      expect(() => order.markAsShipped()).not.toThrow();
      expect(order.status).toBe("SHIPPED");
    });

    it("markAsDelivered should be idempotent", () => {
      const order = OrderEntity.create(validCreateInput());

      order.markAsPaid();
      order.markAsShipped();
      order.markAsDelivered();
      expect(order.status).toBe("DELIVERED");

      // Second call should not throw
      expect(() => order.markAsDelivered()).not.toThrow();
      expect(order.status).toBe("DELIVERED");
    });

    it("cancel should be idempotent", () => {
      const order = OrderEntity.create(validCreateInput());

      order.cancel();
      expect(order.status).toBe("CANCELED");

      // Second call should not throw
      expect(() => order.cancel()).not.toThrow();
      expect(order.status).toBe("CANCELED");
    });

    it("should throw InvalidStateTransitionError for invalid transitions", () => {
      const order = OrderEntity.create(validCreateInput());
      order.cancel();

      expect(() => order.markAsPaid()).toThrow("Cannot transition from CANCELED to PAID");
    });
  });
});
