import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "../../domain/entities/order.entity.js";
import { ResourceNotFoundError } from "../../domain/exceptions/domain.errors.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";
import { GetOrderUseCase } from "./get-order.use-case.js";

function createMockRepository(): IOrderRepository {
  return {
    save: vi.fn(async order => order),
    createWithIdempotency: vi.fn(async () => {}),
    findByIdempotencyKey: vi.fn(async () => null),
    findById: vi.fn(async () => null),
  };
}

describe("GetOrderUseCase", () => {
  it("should return order DTO when found", async () => {
    const repo = createMockRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 }],
    });
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(order);

    const useCase = new GetOrderUseCase(repo);
    const result = await useCase.execute(order.id);

    expect(result.id).toBe(order.id);
    expect(result.customerId).toBe(order.customerId);
    expect(result.totalAmount).toBe(1500);
    expect(result.status).toBe("PENDING");
    expect(result.items).toEqual([{ productId: order.items[0]?.productId, quantity: 1, unitPrice: 1500 }]);
  });

  it("should throw ResourceNotFoundError when not found", async () => {
    const repo = createMockRepository();
    const useCase = new GetOrderUseCase(repo);

    await expect(useCase.execute("nonexistent-id")).rejects.toThrow(ResourceNotFoundError);
  });
});
