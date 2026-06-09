import { z } from "zod";

try {
  process.loadEnvFile();
} catch { }

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
});

export type EnvSchemaType = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables", result.error.issues);
  process.exit(1);
}

export const env: EnvSchemaType = result.data;
