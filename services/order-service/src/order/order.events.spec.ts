import { describe, expect, it } from "vitest";
import { OrderEntity } from "./order.entity.js";
import { buildOrderPlacedEvent, orderPlacedEventSchema } from "./order.events.js";

describe("Order Events", () => {
  it("should build a valid OrderPlacedEvent from an Order", () => {
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
    });

    const event = buildOrderPlacedEvent(order);

    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe("order.placed");
    expect(event.aggregateId).toBe(order.id);
    expect(event.version).toBe(1);
    expect(event.payload.orderId).toBe(order.id);
    expect(event.payload.customerId).toBe(order.customerId);
    expect(event.payload.items).toEqual(order.items);

    // Validate strictly against the schema
    expect(() => orderPlacedEventSchema.parse(event)).not.toThrow();
  });
});
