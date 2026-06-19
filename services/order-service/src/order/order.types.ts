import type { OrderEntity } from "./order.entity.js";
import type { OrderPlacedEvent } from "./order.events.js";

export interface OutboxEventInput {
  eventType: string;
  payload: unknown;
}

export interface IOrdersRepository {
  save(order: OrderEntity, outboxEvent?: OutboxEventInput): Promise<OrderEntity>;
  findById(id: string): Promise<OrderEntity | null>;
}

export interface IOrderPublisherPort {
  publishOrderPlaced(event: OrderPlacedEvent, correlationId?: string): Promise<void>;
  close(): Promise<void>;
}
