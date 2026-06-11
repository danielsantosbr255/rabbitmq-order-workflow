import type { FastifyPluginAsync } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { OrdersService } from './orders.service.js'
import { InMemoryOrdersRepository } from './orders.repository.js'
import { RabbitOrderPublisher } from '../infra/messaging/rabbitmq.publisher.js'
import { apiErrorSchema, createOrderBodySchema, createOrderResponseSchema, orderParamsSchema, orderSchema } from './orders.schemas.js'

export const OrderModule: FastifyPluginAsync = async (app) => {
  const repository = new InMemoryOrdersRepository()
  const publisher = new RabbitOrderPublisher(app.rabbit)
  const service = new OrdersService(repository, publisher)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.addHook('onClose', async () => {
    await publisher.close()
  })

  api.post(
    '/',
    {
      schema: {
        tags: ['orders'],
        body: createOrderBodySchema,
        response: { 202: createOrderResponseSchema },
      },
    },
    async (request, reply) => {
      const order = await service.create(request.body)

      return reply.status(202).send({ orderId: order.id, status: order.status })
    },
  )

  api.get(
    '/:id',
    {
      schema: {
        tags: ['orders'],
        params: orderParamsSchema,
        response: {
          200: orderSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const order = await service.getById(request.params.id)

      return reply.status(200).send(order)
    },
  )
}
