import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "../../domain/entities/order.entity.js";
import { ResourceNotFoundError } from "../../domain/exceptions/domain.errors.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";
import { UpdateOrderStatusUseCase } from "./update-order-status.use-case.js";

function createMockRepository(): IOrderRepository {
  return {
    save: vi.fn(async order => order),
    createWithIdempotency: vi.fn(async () => {}),
    findByIdempotencyKey: vi.fn(async () => null),
    findById: vi.fn(async () => null),
  };
}

describe("UpdateOrderStatusUseCase", () => {
  it("should mark order as PAID", async () => {
    const repo = createMockRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 }],
    });
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(order);

    const useCase = new UpdateOrderStatusUseCase(repo);
    const result = await useCase.execute(order.id, "PAID");

    expect(result.status).toBe("PAID");
    expect(repo.save).toHaveBeenCalledWith(order);
  });

  it("should cancel order", async () => {
    const repo = createMockRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 }],
    });
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(order);

    const useCase = new UpdateOrderStatusUseCase(repo);
    const result = await useCase.execute(order.id, "CANCELED");

    expect(result.status).toBe("CANCELED");
    expect(repo.save).toHaveBeenCalledWith(order);
  });

  it("should mark order as SHIPPED", async () => {
    const repo = createMockRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1500 }],
    });
    // Status can only transition to SHIPPED if it is currently PAID
    order.markAsPaid();
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(order);

    const useCase = new UpdateOrderStatusUseCase(repo);
    const result = await useCase.execute(order.id, "SHIPPED");

    expect(result.status).toBe("SHIPPED");
    expect(repo.save).toHaveBeenCalledWith(order);
  });

  it("should throw ResourceNotFoundError when order not found", async () => {
    const repo = createMockRepository();
    const useCase = new UpdateOrderStatusUseCase(repo);

    await expect(useCase.execute("nonexistent-id", "PAID")).rejects.toThrow(ResourceNotFoundError);
  });
});
