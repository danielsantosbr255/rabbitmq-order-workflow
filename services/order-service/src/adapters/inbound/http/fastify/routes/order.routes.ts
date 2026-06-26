import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { OrderController } from "../controllers/order.controller.js";
import { createOrderRouteSchema, getOrderRouteSchema } from "../schemas/index.js";

export function orderRoutes(controller: OrderController): FastifyPluginAsync {
  return async app => {
    const api = app.withTypeProvider<ZodTypeProvider>();

    api.post("/", { schema: createOrderRouteSchema }, async (request, reply) => {
      const result = await controller.create(request.body, request.headers as never);
      return reply.status(result.statusCode).send(result.body);
    });

    api.get("/:id", { schema: getOrderRouteSchema }, async (request, reply) => {
      const result = await controller.getById(request.params);
      return reply.status(result.statusCode).send(result.body);
    });
  };
}
