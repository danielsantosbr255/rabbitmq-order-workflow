import fp from "fastify-plugin";
import { Connection } from "rabbitmq-client";
import { env } from "../../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    rabbit: Connection;
  }
}

export default fp(async function rabbitmqPlugin(app) {
  const rabbit = new Connection(env.RABBITMQ_URL);

  rabbit.on("error", err => {
    app.log.error({ err }, "RabbitMQ connection error");
  });

  rabbit.on("connection", () => {
    app.log.info("🐰 RabbitMQ connection reestablished");
  });

  app.decorate("rabbit", rabbit);

  app.addHook("onClose", async () => {
    await rabbit.close();
  });
});
