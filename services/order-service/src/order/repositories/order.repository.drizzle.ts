import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../order.db-schema.js";
import { OrderEntity } from "../order.entity.js";
import type { IOrdersRepository } from "../order.types.js";

export class DrizzleOrdersRepository implements IOrdersRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(order: OrderEntity): Promise<OrderEntity> {
    const data = order.toJSON();

    await this.db.transaction(async tx => {
      await tx
        .insert(schema.orders)
        .values({
          id: data.id,
          customerId: data.customerId,
          status: data.status,
          items: data.items,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.orders.id,
          set: {
            status: data.status,
            items: data.items,
            updatedAt: data.updatedAt,
          },
        });
    });

    return order;
  }

  async createWithIdempotency(
    order: OrderEntity,
    idempotencyKey: string,
  ): Promise<OrderEntity | { existingOrder: OrderEntity }> {
    const data = order.toJSON();

    // Fast path: check if key already exists before starting a transaction
    const [existingKey] = await this.db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, idempotencyKey))
      .limit(1);

    if (existingKey) {
      const existingOrder = await this.findById(existingKey.orderId);
      if (existingOrder) return { existingOrder };
    }

    try {
      await this.db.transaction(async tx => {
        // Insert order first to satisfy foreign key constraint
        await tx.insert(schema.orders).values({
          id: data.id,
          customerId: data.customerId,
          status: data.status,
          items: data.items,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });

        // Insert idempotency key second
        await tx.insert(schema.idempotencyKeys).values({
          key: idempotencyKey,
          orderId: data.id,
          createdAt: data.createdAt,
        });
      });
      return order;
    } catch (e) {
      const error = e as { code?: string };
      if (error?.code === "23505") {
        // unique_violation
        // Concurrent request won the race
        const [concurrentKey] = await this.db
          .select()
          .from(schema.idempotencyKeys)
          .where(eq(schema.idempotencyKeys.key, idempotencyKey))
          .limit(1);

        if (concurrentKey) {
          const existingOrder = await this.findById(concurrentKey.orderId);
          if (existingOrder) return { existingOrder };
        }
      }
      throw e;
    }
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const [row] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);

    if (!row) return null;

    return OrderEntity.restore({
      id: row.id,
      customerId: row.customerId,
      status: row.status,
      items: row.items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
