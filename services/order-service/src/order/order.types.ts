import type { OrderEntity } from "./order.entity.js";
import type { OrderPlacedEvent } from "./order.events.js";

export interface IOrdersRepository {
  save(order: OrderEntity): Promise<OrderEntity>;
  findById(id: string): Promise<OrderEntity | null>;
}

export interface IOrderPublisherPort {
  publishOrderPlaced(event: OrderPlacedEvent, correlationId?: string): Promise<void>;
  close(): Promise<void>;
}
