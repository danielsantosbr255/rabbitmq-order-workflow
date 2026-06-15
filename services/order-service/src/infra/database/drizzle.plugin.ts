import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import pg from "pg";
import { env } from "../../config/env.js";
import * as schema from "./schema.js";

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
  }
}

export default fp(async function databasePlugin(app) {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  try {
    const client = await pool.connect();
    client.release();
    app.log.info("🐘 PostgreSQL connection established");
  } catch (error) {
    app.log.error({ error }, "Failed to connect to PostgreSQL");
    throw error;
  }

  const db = drizzle(pool, { schema });

  app.decorate("db", db);

  app.addHook("onClose", async () => {
    app.log.info("Closing database connection pool...");
    await pool.end();
  });
});
