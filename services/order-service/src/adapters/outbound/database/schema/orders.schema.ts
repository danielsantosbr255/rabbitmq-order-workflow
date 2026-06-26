import { integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull(),
  items: jsonb("items").$type<{ productId: string; quantity: number; unitPrice: number }[]>().notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
