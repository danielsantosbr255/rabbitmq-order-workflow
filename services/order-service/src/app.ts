import fastify from "fastify";
import cors from "@fastify/cors";
import { OrderModule } from "./order/order.module.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

export const buildApp = () => {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: { target: "pino-pretty", options: { singleLine: true, colorize: true } },
    },
  });

  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  app.register(AppModule, { prefix: "/" });
  app.register(OrderModule, { prefix: "/orders" });

  return app;
};
