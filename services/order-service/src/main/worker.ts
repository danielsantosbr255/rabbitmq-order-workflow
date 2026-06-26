import { NativeConnection, Worker } from "@temporalio/worker";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { DrizzleOrdersRepository } from "../adapters/outbound/database/repositories/drizzle-order.repository.js";

// ── Adapters & Application ──────────────────────────────────────────
import * as schema from "../adapters/outbound/database/schema/index.js";
import { createActivities } from "../adapters/outbound/temporal/activities.js";
import { UpdateOrderStatusUseCase } from "../application/use-cases/update-order-status.use-case.js";
// ── Config ──────────────────────────────────────────────────────────
import { env } from "./config/env.js";

async function startWorker() {
  // ── Database Connection ─────────────────────────────────────────
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  const client = await pool.connect();
  client.release();
  console.info("🐘 Worker: PostgreSQL connection established");

  const db = drizzle(pool, { schema });

  // ── Dependency Injection ────────────────────────────────────────
  const repository = new DrizzleOrdersRepository(db);
  const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(repository);
  const activities = createActivities(updateOrderStatusUseCase);

  // ── Temporal Worker ─────────────────────────────────────────────
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: "order-saga-task-queue",
    workflowsPath: new URL(
      import.meta.url.endsWith(".ts") ? "./workflows-loader.ts" : "./workflows-loader.js",
      import.meta.url,
    ).pathname,
    activities,
  });

  console.info("🚀 Temporal Worker started on task queue: order-saga-task-queue");

  // Graceful shutdown
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      console.info(`Received ${signal}, shutting down worker…`);
      worker.shutdown();
      await pool.end();
      process.exit(0);
    });
  }

  await worker.run();
}

startWorker().catch(err => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
