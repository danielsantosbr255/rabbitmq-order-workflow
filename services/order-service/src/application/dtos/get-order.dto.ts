import type { OrderStatus } from "../../domain/entities/order.entity.js";

/** Output DTO for the GetOrder use-case. */
export interface GetOrderOutputDTO {
  id: string;
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
