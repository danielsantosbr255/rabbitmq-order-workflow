import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
  process.loadEnvFile();
}

export default defineConfig({
  schema: "./src/infra/database/schema.ts",
  out: "./src/infra/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/orders",
  },
  verbose: true,
  strict: true,
});
