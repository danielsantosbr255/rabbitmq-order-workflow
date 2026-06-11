import type { Connection } from 'rabbitmq-client'
import type { IOrderPublisherPort } from '../../order/orders.types.js'
import type { OrderPlacedEvent } from '../../order/orders.events.js'

export class RabbitOrderPublisher implements IOrderPublisherPort {
  private readonly publisher

  constructor(rabbit: Connection) {
    this.publisher = rabbit.createPublisher({
      confirm: true,
      maxAttempts: 2,
      exchanges: [{ exchange: 'orders', type: 'topic' }]
    })
  }

  async publishOrderPlaced(event: OrderPlacedEvent) {
    await this.publisher.send(
      { exchange: 'orders', routingKey: 'order.placed' },
      event
    )
  }

  async close() {
    await this.publisher.close()
  }
}
