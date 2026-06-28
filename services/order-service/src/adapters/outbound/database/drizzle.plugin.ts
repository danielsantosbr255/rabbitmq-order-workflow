import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import type pg from "pg";
import type * as schema from "./schema/index.js";

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
  }
}

type DatabasePluginOptions = {
  pool: pg.Pool;
  db: NodePgDatabase<typeof schema>;
};

export default fp(async function databasePlugin(app, opts: DatabasePluginOptions) {
  app.decorate("db", opts.db);

  app.addHook("onClose", async () => {
    app.log.info("Closing database connection pool...");
    await opts.pool.end();
  });
});
