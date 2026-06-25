import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";
import { OrderSagaWorkflow } from "./workflows.js";

let client: Client;

export async function initTemporalClient() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  client = new Client({ connection });
}

export async function startOrderSaga(orderId: string, customerId: string, amount: number = 100) {
  if (!client) {
    throw new Error("Temporal client not initialized");
  }

  const handle = await client.workflow.start(OrderSagaWorkflow, {
    args: [orderId, customerId, amount],
    taskQueue: "order-saga-task-queue",
    workflowId: `order-saga-${orderId}`,
    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
  });

  return handle;
}
