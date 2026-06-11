import { ResourceNotFoundError } from "../core/errors/app.errors.js";
import { OrderEntity } from "./order.entity.js";
import { buildOrderPlacedEvent } from "./order.events.js";
import type { CreateOrderBody } from "./order.schemas.js";
import type { IOrderPublisherPort, IOrdersRepository } from "./order.types.js";

export class OrdersService {
  constructor(
    private readonly repository: IOrdersRepository,
    private readonly publisher: IOrderPublisherPort,
  ) {}

  async create(input: CreateOrderBody, correlationId?: string): Promise<OrderEntity> {
    const order = OrderEntity.create(input);

    await this.repository.save(order);
    await this.publisher.publishOrderPlaced(buildOrderPlacedEvent(order), correlationId);

    return order;
  }

  async getById(id: string): Promise<OrderEntity> {
    const order = await this.repository.findById(id);

    if (!order) {
      throw new ResourceNotFoundError("Order", id);
    }

    return order;
  }
}
