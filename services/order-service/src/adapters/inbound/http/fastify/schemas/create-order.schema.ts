import { z } from "zod/v4";
import { apiErrorSchema, orderStatusesSchema } from "./shared.schemas.js";

export const createOrderBodySchema = z.object({
  customerId: z.uuid(),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().positive() })).min(1),
});

export const createOrderResponseSchema = z.object({
  orderId: z.uuid(),
  status: orderStatusesSchema,
});

export const createOrderRouteSchema = {
  headers: z.object({ "x-idempotency-key": z.uuid() }),
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

export type CreateOrderBody = z.infer<typeof createOrderRouteSchema.body>;
export type CreateOrderHeaders = z.infer<typeof createOrderRouteSchema.headers>;
