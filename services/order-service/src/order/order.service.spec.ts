import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "./order.entity.js";
import { OrdersService } from "./order.service.js";
import type { IOrderPublisherPort } from "./order.types.js";
import { InMemoryOrdersRepository } from "./repositories/order.repository.in-memory.js";

describe("OrdersService", () => {
  it("should create an order, save it, and publish an event", async () => {
    const fakeRepo = new InMemoryOrdersRepository();
    const mockPublisher: IOrderPublisherPort = {
      publishOrderPlaced: vi.fn(async () => {}),
      close: vi.fn(),
    };

    const service = new OrdersService(fakeRepo, mockPublisher);
    const input = {
      customerId: crypto.randomUUID(),
      items: [{ productId: crypto.randomUUID(), quantity: 2 }],
    };
    const correlationId = crypto.randomUUID();

    const order = await service.create(input, correlationId);

    expect(order.id).toBeDefined();
    expect(order.status).toBe("PENDING");
    expect(order.customerId).toBe(input.customerId);
    expect(order.items).toEqual(input.items);

    const savedOrder = await fakeRepo.findById(order.id);
    expect(savedOrder).toEqual(order);

    expect(mockPublisher.publishOrderPlaced).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "order.placed", aggregateId: order.id }),
      correlationId,
    );
  });

  it("should return an order if found by id", async () => {
    const fakeRepo = new InMemoryOrdersRepository();
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [],
    });
    await fakeRepo.save(order);
    const mockPublisher = {} as IOrderPublisherPort;

    const service = new OrdersService(fakeRepo, mockPublisher);
    const result = await service.getById(order.id);

    expect(result).toEqual(order);
  });

  it("should throw a 404 error if order is not found", async () => {
    const fakeRepo = new InMemoryOrdersRepository();
    const mockPublisher = {} as IOrderPublisherPort;

    const service = new OrdersService(fakeRepo, mockPublisher);

    await expect(service.getById("123")).rejects.toThrow("Order with identifier '123' was not found.");
  });
});
