import { OrderEntity } from "../../../../domain/entities/order.entity.js";
import type { orders } from "../schema/orders.schema.js";

type OrderRow = typeof orders.$inferSelect;
type OrderInsert = typeof orders.$inferInsert;

export function toDomain(row: OrderRow): OrderEntity {
  return OrderEntity.restore({
    id: row.id,
    customerId: row.customerId,
    items: row.items,
    totalAmount: row.totalAmount,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: OrderEntity): OrderInsert {
  return {
    id: entity.id,
    customerId: entity.customerId,
    items: entity.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.cents,
    })),
    totalAmount: entity.totalAmount.cents,
    status: entity.status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
