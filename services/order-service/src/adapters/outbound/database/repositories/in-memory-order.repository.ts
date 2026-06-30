import type { IOrderRepository } from "../../../../application/ports/order-repository.port.js";
import type { OrderSnapshot } from "../../../../domain/entities/order.entity.js";
import { OrderEntity } from "../../../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../../../domain/exceptions/domain.errors.js";

export class InMemoryOrdersRepository implements IOrderRepository {
  private readonly orders: OrderSnapshot[] = [];
  private readonly idempotencyKeys = new Map<string, string>();

  async save(order: OrderEntity): Promise<OrderEntity> {
    const data = order.toSnapshot();
    const existingIndex = this.orders.findIndex(o => o.id === order.id);
    if (existingIndex > -1) {
      this.orders[existingIndex] = data;
    } else {
      this.orders.push(data);
    }
    return order;
  }

  async findByIdempotencyKey(key: string): Promise<OrderEntity | null> {
    const orderId = this.idempotencyKeys.get(key);
    if (!orderId) return null;
    return this.findById(orderId);
  }

  async createWithIdempotency(order: OrderEntity, idempotencyKey: string): Promise<void> {
    if (this.idempotencyKeys.has(idempotencyKey)) {
      throw new IdempotencyConflictError(idempotencyKey);
    }

    this.idempotencyKeys.set(idempotencyKey, order.id);
    await this.save(order);
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const data = this.orders.find(o => o.id === id);
    if (!data) return null;
    return OrderEntity.restore(data);
  }
}
