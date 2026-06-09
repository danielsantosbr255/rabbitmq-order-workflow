import { env } from "./config/env.js";
import { createServer } from "./server.js";

async function bootstrap() {
  const server = createServer();

  await server.listen({ port: env.PORT, host: env.HOST });

  console.log(`🚀 Server running at: http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
