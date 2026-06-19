import { OrderEntity } from "../order.entity.js";
import type { OrderData } from "../order.schemas.js";
import type { IOrdersRepository, OutboxEventInput } from "../order.types.js";

export class InMemoryOrdersRepository implements IOrdersRepository {
  private readonly orders = new Map<string, OrderData>();
  public readonly outbox: (OutboxEventInput & { aggregateId: string })[] = [];

  async save(order: OrderEntity, outboxEvent?: OutboxEventInput): Promise<OrderEntity> {
    this.orders.set(order.id, order.toJSON());
    if (outboxEvent) {
      this.outbox.push({ ...outboxEvent, aggregateId: order.id });
    }
    return order;
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const data = this.orders.get(id);
    if (!data) return null;
    return OrderEntity.restore(data);
  }
}
