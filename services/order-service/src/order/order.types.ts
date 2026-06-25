import type { OrderEntity } from "./order.entity.js";

export interface IOrdersRepository {
  save(order: OrderEntity): Promise<OrderEntity>;
  createWithIdempotency(order: OrderEntity, idempotencyKey: string): Promise<void>;
  findByIdempotencyKey(key: string): Promise<OrderEntity | null>;
  findById(id: string): Promise<OrderEntity | null>;
}
