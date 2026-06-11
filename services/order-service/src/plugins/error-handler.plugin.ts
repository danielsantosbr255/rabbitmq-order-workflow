import type { FastifyError } from "fastify";
import fp from "fastify-plugin";

export default fp(
  async function errorHandlerPlugin(app) {
    app.setErrorHandler((error: FastifyError, request, reply) => {
      // Validation errors from Zod / Fastify schema validation
      if (error.validation) {
        request.log.warn({ err: error }, "Validation error");

        return reply.status(400).send({
          statusCode: 400,
          error: "Validation Error",
          message: error.message,
        });
      }

      const statusCode = error.statusCode ?? 500;

      // Client errors (4xx) — safe to expose the message
      if (statusCode >= 400 && statusCode < 500) {
        request.log.warn({ err: error }, error.message);

        return reply.status(statusCode).send({
          statusCode,
          error: error.name,
          message: error.message,
        });
      }

      // Server errors (5xx) — never expose internal details to the client
      request.log.error(error);

      return reply.status(statusCode).send({
        statusCode,
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      });
    });
  },
  { name: "error-handler" },
);
