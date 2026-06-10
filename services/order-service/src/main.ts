import { env } from "./config/env.js";
import { buildApp } from "./app.js";

async function bootstrap() {
  const server = buildApp();

  await server.listen({ port: env.PORT, host: env.HOST });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
