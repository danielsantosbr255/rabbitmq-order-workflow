import type { OrderEntity } from "../../domain/entities/order.entity.js";

/**
 * Outbound port for order persistence.
 * Implemented by adapters (DrizzleOrdersRepository, InMemoryOrdersRepository).
 */
export interface IOrderRepository {
  save(order: OrderEntity): Promise<OrderEntity>;
  createWithIdempotency(order: OrderEntity, idempotencyKey: string): Promise<void>;
  findByIdempotencyKey(key: string): Promise<OrderEntity | null>;
  findById(id: string): Promise<OrderEntity | null>;
}
