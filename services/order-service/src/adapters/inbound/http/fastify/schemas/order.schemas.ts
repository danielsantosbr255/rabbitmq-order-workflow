import { z } from "zod/v4";

// ── Shared HTTP primitives ─────────────────────────────────────────

export const orderStatusesSchema = z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"]);

export const orderItemResponseSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
});

// ── Create Order Route ─────────────────────────────────────────────

export const createOrderItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
});

export const createOrderBodySchema = z.object({
  customerId: z.uuid(),
  items: z.array(createOrderItemSchema).min(1),
});

export const createOrderResponseSchema = z.object({
  orderId: z.uuid(),
  status: orderStatusesSchema,
});

export const createOrderHeadersSchema = z.object({
  "x-idempotency-key": z.uuid(),
});

export const apiErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

export const createOrderRouteSchema = {
  headers: createOrderHeadersSchema,
  body: createOrderBodySchema,
  response: {
    201: createOrderResponseSchema,
    200: createOrderResponseSchema,
    400: apiErrorSchema,
  },
  detail: {
    summary: "Create a new order",
    description:
      "Validates HTTP data at the boundary, invokes the CreateOrder Use-Case, persists via DrizzleORM and starts the SAGA on Temporal.io.",
    tags: ["orders"],
  },
};

// ── Get Order Route ────────────────────────────────────────────────

export const orderParamsSchema = z.object({
  id: z.uuid(),
});

export const orderResponseSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  items: z.array(orderItemResponseSchema),
  totalAmount: z.number().int().positive(),
  status: orderStatusesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getOrderRouteSchema = {
  params: orderParamsSchema,
  response: {
    200: orderResponseSchema,
    404: apiErrorSchema,
  },
  detail: {
    summary: "Get an order by ID",
    description: "Retrieves an order's details by its unique identifier.",
    tags: ["orders"],
  },
};

// ── Inferred types (for controller usage) ──────────────────────────

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type CreateOrderHeaders = z.infer<typeof createOrderHeadersSchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;
