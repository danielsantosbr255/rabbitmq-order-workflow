import { buildOrderPlacedEvent } from './orders.events.js'
import type { CreateOrderBody, Order, OrderStatus } from './orders.schemas.js'
import type { IOrdersRepository, IOrderPublisherPort } from './orders.types.js'

export class OrdersService {
  constructor(
    private readonly repository: IOrdersRepository,
    private readonly publisher: IOrderPublisherPort,
  ) { }

  async create(input: CreateOrderBody): Promise<Order> {
    const now = new Date().toISOString()

    const order: Order = {
      id: crypto.randomUUID(),
      customerId: input.customerId,
      items: input.items,
      status: 'PENDING' satisfies OrderStatus,
      createdAt: now,
      updatedAt: now,
    }

    await this.repository.save(order)
    await this.publisher.publishOrderPlaced(buildOrderPlacedEvent(order))

    return order
  }

  async getById(id: string): Promise<Order> {
    const order = await this.repository.findById(id)

    if (!order) {
      throw Object.assign(new Error(`Order ${id} not found`), { statusCode: 404 })
    }

    return order
  }
}
