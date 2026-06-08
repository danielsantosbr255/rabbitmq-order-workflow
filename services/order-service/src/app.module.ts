import fastify from "fastify";
import cors from "@fastify/cors";
import { OrderModule } from "./order/order.module.js";

export const createApp = () => {
  const app = fastify();

  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  app.register(OrderModule, { prefix: "/orders" });

  return app;
};
