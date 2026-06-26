import type { OrderStatus } from "../../domain/entities/order.entity.js";

/** Input DTO for the CreateOrder use-case (technology-agnostic). */
export interface CreateOrderInputDTO {
  customerId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
}

/** Output DTO for the CreateOrder use-case. */
export interface CreateOrderOutputDTO {
  orderId: string;
  status: OrderStatus;
  isNew: boolean;
}
