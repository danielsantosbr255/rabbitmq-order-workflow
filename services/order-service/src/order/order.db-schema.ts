import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { OrderItem, OrderStatus } from "./order.schemas.js";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull(),
  items: jsonb("items").$type<OrderItem[]>().notNull(),
  status: varchar("status", { length: 50 }).$type<OrderStatus>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
  },
  table => [index("idx_outbox_unprocessed").on(table.createdAt).where(sql`${table.processed} = false`)],
);
