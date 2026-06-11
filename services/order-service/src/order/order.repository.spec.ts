import { describe, expect, it } from "vitest";
import { OrderEntity } from "./order.entity.js";
import { InMemoryOrdersRepository } from "./order.repository.js";

describe("InMemoryOrdersRepository", () => {
  it("should save and find an order by id", async () => {
    const repository = new InMemoryOrdersRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    });

    const savedOrder = await repository.save(order);
    expect(savedOrder.toJSON()).toEqual(order.toJSON());

    const foundOrder = await repository.findById(order.id);
    expect(foundOrder?.toJSON()).toEqual(order.toJSON());
  });

  it("should return null if order is not found", async () => {
    const repository = new InMemoryOrdersRepository();
    const foundOrder = await repository.findById(crypto.randomUUID());
    expect(foundOrder).toBeNull();
  });
});
