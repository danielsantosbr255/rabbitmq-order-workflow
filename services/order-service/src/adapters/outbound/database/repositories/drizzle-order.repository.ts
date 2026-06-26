import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IOrderRepository } from "../../../../application/ports/order-repository.port.js";
import type { OrderEntity } from "../../../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../../../domain/exceptions/domain.errors.js";
import * as OrderMapper from "../mappers/order.mapper.js";
import * as schema from "../schema/index.js";

export class DrizzleOrdersRepository implements IOrderRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(order: OrderEntity): Promise<OrderEntity> {
    const data = OrderMapper.toPersistence(order);

    await this.db.transaction(async tx => {
      await tx
        .insert(schema.orders)
        .values(data)
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
    const data = OrderMapper.toPersistence(order);

    try {
      await this.db.transaction(async tx => {
        // Insert order first to satisfy foreign key constraint
        await tx.insert(schema.orders).values(data);

        // Insert idempotency key second
        await tx.insert(schema.idempotencyKeys).values({
          key: idempotencyKey,
          orderId: data.id,
          createdAt: data.createdAt,
        });
      });
    } catch (e: unknown) {
      // Drizzle wraps the original error. We check either the e.code, the e.cause.code or the message
      const error = e as { code?: string; cause?: { code?: string }; message?: string };
      const isDuplicateKey =
        error.code === "23505" ||
        error.cause?.code === "23505" ||
        (typeof error.message === "string" && error.message.includes("duplicate key value"));

      if (isDuplicateKey) {
        throw new IdempotencyConflictError(idempotencyKey);
      }
      throw e;
    }
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const [row] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);

    if (!row) return null;

    return OrderMapper.toDomain(row);
  }
}
