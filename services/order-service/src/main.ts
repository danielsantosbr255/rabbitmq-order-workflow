import { env } from './config/env.js'
import { buildApp } from './app.js'

async function bootstrap() {
  const server = await buildApp()

  await server.listen({ port: env.PORT, host: env.HOST })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      server.log.info(`Received ${signal}, shutting down gracefully…`)
      await server.close()
      process.exit(0)
    })
  }
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
