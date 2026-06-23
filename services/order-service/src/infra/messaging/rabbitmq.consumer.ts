import type { FastifyBaseLogger } from "fastify";
import { type Connection, ConsumerStatus } from "rabbitmq-client";
import type { OrdersService } from "../../order/order.service.js";

interface BaseEventPayload {
  orderId: string;
}

export class RabbitOrderConsumer {
  private consumer;

  constructor(
    rabbit: Connection,
    private readonly ordersService: OrdersService,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.consumer = rabbit.createConsumer(
      {
        queue: "order.events",
        queueOptions: {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": "order.events.dlq",
          },
        },
        exchanges: [{ exchange: "orders", type: "topic", durable: true }],
        queueBindings: [
          { exchange: "orders", routingKey: "payment.processed" },
          { exchange: "orders", routingKey: "shipping.completed" },
          { exchange: "orders", routingKey: "shipping.failed" },
          { exchange: "orders", routingKey: "payment.refunded" },
        ],
      },
      async msg => {
        try {
          const routingKey = msg.routingKey;
          const payload = msg.body?.payload as BaseEventPayload;

          if (!payload?.orderId) {
            this.logger.error({ routingKey }, "Malformed message (without orderId), sending to DLQ");
            return ConsumerStatus.DROP;
          }

          const orderId = payload.orderId;

          switch (routingKey) {
            case "payment.processed": {
              const status = msg.body?.payload?.status;
              await this.ordersService.processPaymentResult(orderId, status);
              break;
            }

            case "shipping.completed":
              await this.ordersService.processShippingResult(orderId, "COMPLETED");
              break;

            case "shipping.failed":
              await this.ordersService.processShippingResult(orderId, "FAILED");
              break;

            case "payment.refunded":
              await this.ordersService.compensateOrder(orderId);
              break;

            default:
              this.logger.warn({ routingKey, orderId }, "Unknown routing key ignored");
              return ConsumerStatus.ACK;
          }

          return ConsumerStatus.ACK;
        } catch (err) {
          this.logger.error({ err }, "Error processing message, rejecting to DLQ");
          return ConsumerStatus.DROP;
        }
      },
    );

    this.consumer.on("error", err => {
      this.logger.error({ err }, "Error in RabbitMQ consumer");
    });
  }

  async close() {
    await this.consumer.close();
  }
}
