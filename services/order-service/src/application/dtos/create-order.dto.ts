import type { OrderStatus } from "../../domain/entities/order.entity.js";

export interface CreateOrderInputDTO {
  customerId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
}

export interface CreateOrderOutputDTO {
  orderId: string;
  status: OrderStatus | "ACCEPTED";
  isNew: boolean;
}
