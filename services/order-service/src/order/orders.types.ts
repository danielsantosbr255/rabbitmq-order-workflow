import type { Order } from './orders.schemas.js'
import type { OrderPlacedEvent } from './orders.events.js'

export interface IOrdersRepository {
  save(order: Order): Promise<Order>
  findById(id: string): Promise<Order | null>
}

export interface IOrderPublisherPort {
  publishOrderPlaced(event: OrderPlacedEvent): Promise<void>
  close(): Promise<void>
}
