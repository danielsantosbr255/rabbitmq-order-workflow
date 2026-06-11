import type { Connection, Envelope } from "rabbitmq-client";
import { describe, expect, it, vi } from "vitest";
import type { OrderPlacedEvent } from "../../order/order.events.js";
import { RabbitOrderPublisher } from "./rabbitmq.publisher.js";

describe("RabbitOrderPublisher", () => {
  it("should publish order placed event with correct envelope", async () => {
    const mockSend = vi.fn(async (_envelope: Envelope, _payload: unknown) => {});
    const mockClose = vi.fn();
    const mockConnection = {
      createPublisher: vi.fn(() => ({
        send: mockSend,
        close: mockClose,
      })),
    } as unknown as Connection;

    const publisher = new RabbitOrderPublisher(mockConnection);
    const event: OrderPlacedEvent = {
      eventId: crypto.randomUUID(),
      eventType: "order.placed",
      aggregateId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {
        orderId: crypto.randomUUID(),
        customerId: crypto.randomUUID(),
        items: [],
      },
    };
    const correlationId = crypto.randomUUID();

    await publisher.publishOrderPlaced(event, correlationId);

    expect(mockSend).toHaveBeenCalledTimes(1);

    const [envelope, payload] = mockSend.mock.calls[0] as [Envelope, unknown];

    expect(payload).toEqual(event);
    expect(envelope.exchange).toBe("orders");
    expect(envelope.routingKey).toBe("order.placed");
    expect(envelope.durable).toBe(true);
    expect(envelope.contentType).toBe("application/json");
    expect(envelope.messageId).toBe(event.eventId);
    expect(envelope.correlationId).toBe(correlationId);
    expect(envelope.headers?.["x-event-type"]).toBe("order.placed");
  });
});
