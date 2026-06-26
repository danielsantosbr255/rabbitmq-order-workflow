import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../domain/exceptions/domain.errors.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";
import { CreateOrderUseCase } from "./create-order.use-case.js";

function createMockRepository(): IOrderRepository {
  return {
    save: vi.fn(async order => order),
    createWithIdempotency: vi.fn(async () => {}),
    findByIdempotencyKey: vi.fn(async () => null),
    findById: vi.fn(async () => null),
  };
}

function createMockCatalog(): IProductCatalog {
  return {
    getProductPrice: vi.fn(async () => 5000),
  };
}

function createMockSagaOrchestrator(): ISagaOrchestrator {
  return {
    startOrderSaga: vi.fn(async () => {}),
  };
}

describe("CreateOrderUseCase", () => {
  it("should create an order, persist it, and start the SAGA", async () => {
    const repo = createMockRepository();
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();

    const useCase = new CreateOrderUseCase(repo, catalog, saga);

    const result = await useCase.execute({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
      idempotencyKey: crypto.randomUUID(),
    });

    expect(result.isNew).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.status).toBe("PENDING");

    expect(catalog.getProductPrice).toHaveBeenCalledOnce();
    expect(repo.createWithIdempotency).toHaveBeenCalledOnce();
    expect(saga.startOrderSaga).toHaveBeenCalledWith(result.orderId, expect.any(String), 10000); // 2 * 5000
  });

  it("should return existing order on idempotency conflict", async () => {
    const repo = createMockRepository();
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();

    const existingOrder = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 5000 }],
    });

    const idempotencyKey = crypto.randomUUID();
    (repo.createWithIdempotency as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new IdempotencyConflictError(idempotencyKey),
    );
    (repo.findByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existingOrder);

    const useCase = new CreateOrderUseCase(repo, catalog, saga);

    const result = await useCase.execute({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
      idempotencyKey,
    });

    expect(result.isNew).toBe(false);
    expect(result.orderId).toBe(existingOrder.id);
    expect(saga.startOrderSaga).not.toHaveBeenCalled();
  });
});
