import fastify from "fastify";
import cors from "@fastify/cors";
import { OrderModule } from "./order/order.module.js";
import { AppModule } from "./app.module.js";

export const createServer = () => {
  const app = fastify();

  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  app.register(AppModule, { prefix: "/" });
  app.register(OrderModule, { prefix: "/orders" });

  return app;
};
