import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import pg from "pg";
import * as schema from "./schema/index.js";

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
  }
}

export default fp(async function databasePlugin(app, opts: { databaseUrl: string }) {
  const pool = new pg.Pool({
    connectionString: opts.databaseUrl,
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
