import { z } from "zod/v4";

export const orderStatusesSchema = z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"]);

export const orderItemResponseSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});
