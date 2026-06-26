import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { orders } from "./orders.schema.js";

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: uuid("key").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
