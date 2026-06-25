import type { OrderEntity } from "./order.entity.js";

export interface IOrdersRepository {
  save(order: OrderEntity): Promise<OrderEntity>;
  createWithIdempotency(
    order: OrderEntity,
    idempotencyKey: string,
  ): Promise<OrderEntity | { existingOrder: OrderEntity }>;
  findById(id: string): Promise<OrderEntity | null>;
}
