import { createApp } from "./app.module.js";

async function bootstrap() {
  const app = await createApp();

  const addr = await app.listen({ port: 3001, host: '0.0.0.0' });

  console.log(`Server running at ${addr}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
