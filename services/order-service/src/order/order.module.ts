import type { FastifyInstance } from "fastify";
import { OrderController } from "./order.controller.js";
import { OrderService } from "./order.service.js";
import { OrderRepository } from "./order.repository.js";

export const OrderModule = (app: FastifyInstance) => {
  const repository = new OrderRepository();
  const service = new OrderService(repository);
  const controller = new OrderController(service);

  app.post("/", controller.create);
  app.get("/", controller.getAll);
};
