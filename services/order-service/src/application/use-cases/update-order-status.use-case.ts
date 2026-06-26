import type { OrderEntity } from "../../domain/entities/order.entity.js";
import { ResourceNotFoundError } from "../../domain/exceptions/domain.errors.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";

type OrderStatusUpdate = "PAID" | "SHIPPED" | "CANCELED";

export class UpdateOrderStatusUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string, status: OrderStatusUpdate): Promise<OrderEntity> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundError("Order", orderId);
    }

    switch (status) {
      case "PAID":
        order.markAsPaid();
        break;
      case "SHIPPED":
        order.markAsShipped();
        break;
      case "CANCELED":
        order.cancel();
        break;
    }

    return this.orderRepository.save(order);
  }
}
