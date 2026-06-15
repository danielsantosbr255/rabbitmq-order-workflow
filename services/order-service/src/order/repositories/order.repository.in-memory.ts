import { OrderEntity } from "../order.entity.js";
import type { OrderData } from "../order.schemas.js";
import type { IOrdersRepository } from "../order.types.js";

export class InMemoryOrdersRepository implements IOrdersRepository {
  private readonly orders = new Map<string, OrderData>();

  async save(order: OrderEntity): Promise<OrderEntity> {
    this.orders.set(order.id, order.toJSON());
    return order;
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const data = this.orders.get(id);
    if (!data) return null;
    return OrderEntity.restore(data);
  }
}
