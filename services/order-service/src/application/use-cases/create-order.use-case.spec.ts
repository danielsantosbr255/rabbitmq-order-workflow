import { describe, expect, it, vi } from "vitest";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";
import { CreateOrderUseCase } from "./create-order.use-case.js";

function createMockCatalog(): IProductCatalog {
  return { getProductPrice: vi.fn(async () => 5000) };
}

function createMockSagaOrchestrator(): ISagaOrchestrator {
  return { startOrderSaga: vi.fn(async () => ({ isNew: true })) };
}

describe("CreateOrderUseCase", () => {
  it("should validate domain, serialize, and start the SAGA workflow", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();

    const useCase = new CreateOrderUseCase(catalog, saga);

    const result = await useCase.execute({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
      idempotencyKey: crypto.randomUUID(),
    });

    expect(result.isNew).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.status).toBe("ACCEPTED");

    expect(catalog.getProductPrice).toHaveBeenCalledOnce();
    expect(saga.startOrderSaga).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: result.orderId,
        totalAmountCents: 10000, // 2 * 5000
      }),
    );
  });

  it("should return isNew false when workflow already exists (idempotency)", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();
    (saga.startOrderSaga as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isNew: false });

    const useCase = new CreateOrderUseCase(catalog, saga);

    const result = await useCase.execute({
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
      idempotencyKey: crypto.randomUUID(),
    });

    expect(result.isNew).toBe(false);
    expect(result.status).toBe("ACCEPTED");
    expect(saga.startOrderSaga).toHaveBeenCalledOnce();
  });

  it("should fail fast on invalid domain data before touching Temporal", async () => {
    const catalog = createMockCatalog();
    const saga = createMockSagaOrchestrator();

    const useCase = new CreateOrderUseCase(catalog, saga);

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
