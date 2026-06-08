import fp from 'fastify-plugin';
import { Connection } from 'rabbitmq-client';

export default fp(async (fastify, _opts) => {
  const rabbit = new Connection({ url: 'amqp://guest:guest@localhost:5672' });

  fastify.addHook('onClose', async () => {
    await rabbit.close();
  });

  fastify.decorate('rabbit', rabbit);
  
  rabbit.on('error', (err) => {
    fastify.log.error(err, 'RabbitMQ Connection Error');
  });

  console.log('🐰 RabbitMQ Connected!');
});

declare module 'fastify' {
  interface FastifyInstance {
    rabbit: Connection;
  }
}
