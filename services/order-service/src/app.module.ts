import type { FastifyInstance } from "fastify";

export const AppModule = (app: FastifyInstance) => {
  app.get("/", async () => {
    return { message: "Order Service is running" };
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });
};
