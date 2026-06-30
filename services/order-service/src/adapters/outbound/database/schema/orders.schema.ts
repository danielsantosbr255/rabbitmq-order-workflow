import { integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull(),
  items: jsonb("items").$type<{ productId: string; quantity: number; unitPrice: number }[]>().notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: orderStatusEnum("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
