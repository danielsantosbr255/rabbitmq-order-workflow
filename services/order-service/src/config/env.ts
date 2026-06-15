import { existsSync } from "node:fs";
import { z } from "zod";

if (existsSync(".env")) {
  process.loadEnvFile();
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  RABBITMQ_URL: z.url().default("amqp://guest:guest@localhost:5672"),
  DATABASE_URL: z.url().default("postgres://postgres:postgres@localhost:5432/orders"),
});

export type EnvSchemaType = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables", result.error.issues);
  process.exit(1);
}

export const env: EnvSchemaType = result.data;
