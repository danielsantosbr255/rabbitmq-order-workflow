import type { FastifyInstance } from "fastify";

export const OrderModule = (app: FastifyInstance) => {
  app.get('/', async () => {
    return { status: 200, message: 'Orders' };
  });

  app.post('/', async () => {
    return { status: 201, message: 'Order created' };
  });
};
