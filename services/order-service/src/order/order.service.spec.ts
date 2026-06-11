import { describe, expect, it, vi } from "vitest";
import { OrderEntity } from "./order.entity.js";
import { OrdersService } from "./order.service.js";
import type { IOrderPublisherPort, IOrdersRepository } from "./order.types.js";

describe("OrdersService", () => {
  it("should create an order, save it, and publish an event", async () => {
    const mockRepo: IOrdersRepository = {
      save: vi.fn(async o => o),
      findById: vi.fn(),
    };
    const mockPublisher: IOrderPublisherPort = {
      publishOrderPlaced: vi.fn(async () => {}),
      close: vi.fn(),
    };

    const service = new OrdersService(mockRepo, mockPublisher);
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

    expect(mockRepo.save).toHaveBeenCalledWith(order);
    expect(mockPublisher.publishOrderPlaced).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "order.placed", aggregateId: order.id }),
      correlationId,
    );
  });

  it("should return an order if found by id", async () => {
    const order = OrderEntity.create({
      customerId: crypto.randomUUID(),
      items: [],
    });
    const mockRepo: IOrdersRepository = {
      save: vi.fn(),
      findById: vi.fn(async () => order),
    };
    const mockPublisher = {} as IOrderPublisherPort;

    const service = new OrdersService(mockRepo, mockPublisher);
    const result = await service.getById(order.id);

    expect(result).toEqual(order);
    expect(mockRepo.findById).toHaveBeenCalledWith(order.id);
  });

  it("should throw a 404 error if order is not found", async () => {
    const mockRepo: IOrdersRepository = {
      save: vi.fn(),
      findById: vi.fn(async () => null),
    };
    const mockPublisher = {} as IOrderPublisherPort;

    const service = new OrdersService(mockRepo, mockPublisher);

    await expect(service.getById("123")).rejects.toThrow("Order with identifier '123' was not found.");
  });
});
