import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { IdempotencyConflictError } from "../../core/errors/app.errors.js";
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
          items: data.items,
          totalAmount: data.totalAmount,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.orders.id,
          set: {
            status: data.status,
            items: data.items,
            totalAmount: data.totalAmount,
            updatedAt: data.updatedAt,
          },
        });
    });

    return order;
  }

  async findByIdempotencyKey(key: string): Promise<OrderEntity | null> {
    const [existingKey] = await this.db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key))
      .limit(1);

    if (!existingKey) return null;
    return this.findById(existingKey.orderId);
  }

  async createWithIdempotency(order: OrderEntity, idempotencyKey: string): Promise<void> {
    const data = order.toJSON();

    try {
      await this.db.transaction(async tx => {
        // Insert order first to satisfy foreign key constraint
        await tx.insert(schema.orders).values({
          id: data.id,
          customerId: data.customerId,
          items: data.items,
          totalAmount: data.totalAmount,
          status: data.status,
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
    } catch (e) {
      const error = e as { code?: string };
      if (error?.code === "23505") {
        throw new IdempotencyConflictError(idempotencyKey);
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
      items: row.items,
      totalAmount: row.totalAmount,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
