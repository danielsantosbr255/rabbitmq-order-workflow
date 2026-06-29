import { describe, expect, it, vi } from "vitest";
import { InMemoryOrdersRepository } from "../../adapters/outbound/database/repositories/in-memory-order.repository.js";
import { OrderEntity } from "../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../domain/exceptions/domain.errors.js";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";
import { CreateOrderUseCase } from "./create-order.use-case.js";

function createMockCatalog(): IProductCatalog {
  return { getProductPrice: vi.fn(async () => 5000) };
}

function createMockSagaOrchestrator(): ISagaOrchestrator {
  return { startOrderSaga: vi.fn(async () => {}) };
}

describe("CreateOrderUseCase", () => {
  it("should validate domain, serialize, and start the SAGA workflow", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    const repo = new InMemoryOrdersRepository();

    const useCase = new CreateOrderUseCase(catalog, saga, repo);

    const result = await useCase.execute({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
      idempotencyKey: crypto.randomUUID(),
    });

    expect(result.isNew).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.status).toBe("ACCEPTED");

    expect(catalog.getProductPrice).toHaveBeenCalledOnce();
    expect(saga.startOrderSaga).toHaveBeenCalledWith(expect.any(OrderEntity), expect.any(String));
  });

  it("should return isNew false when workflow already exists (idempotency)", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    const repo = new InMemoryOrdersRepository();

    // Seed the repository with an existing order
    const existingOrder = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1, unitPrice: 1000 }],
    });
    await repo.createWithIdempotency(existingOrder, "existing-idempotency-key");

    // Make the Saga port throw a conflict
    (saga.startOrderSaga as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new IdempotencyConflictError("existing-idempotency-key"),
    );

    const useCase = new CreateOrderUseCase(catalog, saga, repo);

    const result = await useCase.execute({
      customerId: existingOrder.customerId,
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
      idempotencyKey: "existing-idempotency-key",
    });

    expect(result.isNew).toBe(false);
    expect(result.orderId).toBe(existingOrder.id);
    expect(result.status).toBe(existingOrder.status);
  });

  it("should throw error if workflow is running but DB has no record yet (race condition)", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    const repo = new InMemoryOrdersRepository();

    // Make the Saga port throw a conflict, but DO NOT seed the DB (simulating race condition)
    (saga.startOrderSaga as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new IdempotencyConflictError("race-key"));

    const useCase = new CreateOrderUseCase(catalog, saga, repo);

    await expect(
      useCase.execute({
        customerId: crypto.randomUUID(),
        items: [{ productId: crypto.randomUUID(), quantity: 2 }],
        idempotencyKey: "race-key",
      }),
    ).rejects.toThrow("Order creation is in progress but not yet committed to database. Please retry in a moment.");
  });

  it("should rethrow unknown errors from Saga orchestrator", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    const repo = new InMemoryOrdersRepository();

    const unknownError = new Error("Temporal connection down");
    (saga.startOrderSaga as ReturnType<typeof vi.fn>).mockRejectedValueOnce(unknownError);

    const useCase = new CreateOrderUseCase(catalog, saga, repo);

    await expect(
      useCase.execute({
        customerId: crypto.randomUUID(),
        items: [{ productId: crypto.randomUUID(), quantity: 1 }],
        idempotencyKey: "new-key",
      }),
    ).rejects.toThrow("Temporal connection down");
  });

  it("should fail fast on invalid domain data before touching Temporal", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    const repo = new InMemoryOrdersRepository();

    const useCase = new CreateOrderUseCase(catalog, saga, repo);

    await expect(
      useCase.execute({
        customerId: "not-a-uuid",
        items: [{ productId: crypto.randomUUID(), quantity: 1 }],
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("customerId must be a valid UUID");

    // Temporal should never be called if domain validation fails
    expect(saga.startOrderSaga).not.toHaveBeenCalled();
  });
});
