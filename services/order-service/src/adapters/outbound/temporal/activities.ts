import type { IOrderRepository } from "../../../application/ports/order-repository.port.js";
import type { UpdateOrderStatusUseCase } from "../../../application/use-cases/update-order-status.use-case.js";
import { OrderEntity } from "../../../domain/entities/order.entity.js";
import type { CreateOrderActivityInput } from "./activities.interfaces.js";

export function createActivities(
  updateOrderStatusUseCase: UpdateOrderStatusUseCase,
  orderRepository: IOrderRepository,
) {
  return {
    async createOrder(input: CreateOrderActivityInput): Promise<void> {
      const now = new Date().toISOString();
      const order = OrderEntity.restore({
        id: input.orderId,
        customerId: input.customerId,
        items: input.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPriceCents,
        })),
        totalAmount: input.totalAmountCents,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      });
      await orderRepository.createWithIdempotency(order, input.idempotencyKey);
    },

    async updateOrderStatus(orderId: string, status: "PAID" | "SHIPPED" | "CANCELED"): Promise<void> {
      await updateOrderStatusUseCase.execute(orderId, status);
    },
  };
}

export type OrderActivities = ReturnType<typeof createActivities>;
