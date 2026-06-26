import { OrderEntity } from "../../../../domain/entities/order.entity.js";
import type { orders } from "../schema/orders.schema.js";

/** Raw row shape returned by a SELECT on the orders table */
type OrderRow = typeof orders.$inferSelect;

/** Shape accepted by INSERT on the orders table */
type OrderInsert = typeof orders.$inferInsert;

/**
 * Bidirectional mapper between Domain (OrderEntity) and Persistence (Drizzle rows).
 * Lives in the adapter layer — the entity never knows about Drizzle types.
 */
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
