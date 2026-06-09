import type { FastifyRequest, FastifyReply } from "fastify";
import type { OrderService } from "./order.service.js";
import type { Order } from "./order.types.js";

export class OrderController {
  constructor(private readonly service: OrderService) { }

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const createdOrder = await this.service.create(request.body as Order);
    reply.status(201).send(createdOrder);
  }

  getAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const orders = await this.service.getAll();
    reply.status(200).send(orders);
  }
}
