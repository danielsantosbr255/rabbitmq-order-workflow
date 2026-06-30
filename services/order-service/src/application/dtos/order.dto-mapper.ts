import type { OrderEntity } from "../../domain/entities/order.entity.js";
import type { GetOrderOutputDTO } from "./get-order.dto.js";

export function toGetOrderOutputDTO(order: OrderEntity): GetOrderOutputDTO {
  return order.toSnapshot();
}
