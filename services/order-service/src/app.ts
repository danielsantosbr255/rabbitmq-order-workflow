import fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { env } from './config/env.js'
import errorHandlerPlugin from './plugins/error-handler.plugin.js'
import rabbitmqPlugin from './infra/messaging/rabbitmq.plugin.js'
import { OrderModule } from './order/orders.module.js'

export const buildApp = async () => {
  const app = fastify({
    logger:
      env.NODE_ENV === 'production'
        ? { level: 'info' }
        : {
          level: 'debug',
          transport: {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true },
          },
        },
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(sensible)
  await app.register(errorHandlerPlugin)

  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  await app.register(rabbitmqPlugin)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(OrderModule, { prefix: '/orders' })

  return app
}
