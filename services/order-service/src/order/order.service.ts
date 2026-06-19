import { ResourceNotFoundError } from "../core/errors/app.errors.js";
import { OrderEntity } from "./order.entity.js";
import { buildOrderPlacedEvent } from "./order.events.js";
import type { CreateOrderBody } from "./order.schemas.js";
import type { IOrdersRepository } from "./order.types.js";

export class OrdersService {
  constructor(private readonly repository: IOrdersRepository) {}

  async create(input: CreateOrderBody, _correlationId?: string): Promise<OrderEntity> {
    const order = OrderEntity.create(input);

    await this.repository.save(order, {
      eventType: "order.placed",
      payload: buildOrderPlacedEvent(order),
    });

    return order;
  }

  async getById(id: string): Promise<OrderEntity> {
    const order = await this.repository.findById(id);
    if (!order) throw new ResourceNotFoundError("Order", id);
    return order;
  }
}
