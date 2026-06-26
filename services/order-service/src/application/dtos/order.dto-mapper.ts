import type { OrderEntity } from "../../domain/entities/order.entity.js";
import type { GetOrderOutputDTO } from "./get-order.dto.js";

/**
 * Maps Domain Entities to Application DTOs.
 * We do not reuse the database mapper (OrderMapper) here because:
 * 1. Database Mappers belong to the persistence adapter (Outbound), knowing about database schemas.
 * 2. DTO Mappers belong to the application layer, defining the contract for inbound drivers (like HTTP).
 * Mixing them creates coupling between the database structure and the API response.
 */
export function toGetOrderOutputDTO(order: OrderEntity): GetOrderOutputDTO {
  return {
    id: order.id,
    customerId: order.customerId,
    items: order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.cents,
    })),
    totalAmount: order.totalAmount.cents,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
