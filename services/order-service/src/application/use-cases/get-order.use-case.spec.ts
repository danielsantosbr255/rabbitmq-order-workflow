import { describe, expect, it } from "vitest";
import { InMemoryOrdersRepository } from "../../adapters/outbound/database/repositories/in-memory-order.repository.js";
import { OrderEntity } from "../../domain/entities/order.entity.js";
import { ResourceNotFoundError } from "../../domain/exceptions/domain.errors.js";
import { GetOrderUseCase } from "./get-order.use-case.js";

describe("GetOrderUseCase", () => {
  it("should return order DTO when found", async () => {
    const repo = new InMemoryOrdersRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 }],
    });
    await repo.save(order);

    const useCase = new GetOrderUseCase(repo);
    const result = await useCase.execute(order.id);

    expect(result.id).toBe(order.id);
    expect(result.customerId).toBe(order.customerId);
    expect(result.totalAmount).toBe(1500);
    expect(result.status).toBe("PENDING");
    expect(result.items).toEqual([{ productId: order.items[0]?.productId, quantity: 1, unitPrice: 1500 }]);
  });

  it("should throw ResourceNotFoundError when not found", async () => {
    const repo = new InMemoryOrdersRepository();
    const useCase = new GetOrderUseCase(repo);

    await expect(useCase.execute("nonexistent-id")).rejects.toThrow(ResourceNotFoundError);
  });
});
