import type { IOrderRepository } from "../../../../application/ports/order-repository.port.js";
import { OrderEntity } from "../../../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../../../domain/exceptions/domain.errors.js";

interface StoredOrder {
  id: string;
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryOrdersRepository implements IOrderRepository {
  private readonly orders: StoredOrder[] = [];
  private readonly idempotencyKeys = new Map<string, string>();

  async save(order: OrderEntity): Promise<OrderEntity> {
    const data = this.entityToStoredOrder(order);
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

  private entityToStoredOrder(entity: OrderEntity): StoredOrder {
    return {
      id: entity.id,
      customerId: entity.customerId,
      items: entity.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.cents,
      })),
      totalAmount: entity.totalAmount.cents,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
