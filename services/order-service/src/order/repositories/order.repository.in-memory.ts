import { OrderEntity } from "../order.entity.js";
import type { OrderData } from "../order.schemas.js";
import type { IOrdersRepository } from "../order.types.js";

export class InMemoryOrdersRepository implements IOrdersRepository {
  private readonly orders: OrderData[] = [];
  private readonly idempotencyKeys = new Map<string, string>();

  async save(order: OrderEntity): Promise<OrderEntity> {
    const existingIndex = this.orders.findIndex(o => o.id === order.id);
    if (existingIndex > -1) {
      this.orders[existingIndex] = order.toJSON();
    } else {
      this.orders.push(order.toJSON());
    }
    return order;
  }

  async createWithIdempotency(
    order: OrderEntity,
    idempotencyKey: string,
  ): Promise<OrderEntity | { existingOrder: OrderEntity }> {
    if (this.idempotencyKeys.has(idempotencyKey)) {
      const existingOrderId = this.idempotencyKeys.get(idempotencyKey);
      if (existingOrderId) {
        const existingOrder = await this.findById(existingOrderId);
        if (existingOrder) {
          return { existingOrder };
        }
      }
    }

    this.idempotencyKeys.set(idempotencyKey, order.id);
    return this.save(order);
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const data = this.orders.find(o => o.id === id);
    if (!data) return null;
    return OrderEntity.restore(data);
  }
}
