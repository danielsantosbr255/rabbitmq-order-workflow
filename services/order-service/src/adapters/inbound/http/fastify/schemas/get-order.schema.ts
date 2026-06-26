import { z } from "zod/v4";
import { apiErrorSchema, orderItemResponseSchema, orderStatusesSchema } from "./shared.schemas.js";

export const getOrderRouteSchema = {
  params: z.object({ id: z.uuid() }),
  response: {
    200: z.object({
      id: z.uuid(),
      customerId: z.uuid(),
      items: z.array(orderItemResponseSchema),
      totalAmount: z.number().int().positive(),
      status: orderStatusesSchema,
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
    404: apiErrorSchema,
  },
  detail: {
    summary: "Get an order by ID",
    description: "Retrieves an order's details by its unique identifier.",
    tags: ["orders"],
  },
};

export type OrderParams = z.infer<typeof getOrderRouteSchema.params>;
