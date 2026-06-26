import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";
import type { ISagaOrchestrator } from "../../../application/ports/saga-orchestrator.port.js";
import { OrderSagaWorkflow } from "./workflows.js";

/**
 * Temporal.io adapter implementing the ISagaOrchestrator port.
 * Encapsulates all Temporal SDK details behind the hexagonal boundary.
 */
export class TemporalSagaAdapter implements ISagaOrchestrator {
  private client: Client | null = null;

  async connect(address: string): Promise<void> {
    const connection = await Connection.connect({ address });
    this.client = new Client({ connection });
  }

  async startOrderSaga(orderId: string, customerId: string, amount: number): Promise<void> {
    if (!this.client) {
      throw new Error("Temporal client not initialized. Call connect() first.");
    }

    await this.client.workflow.start(OrderSagaWorkflow, {
      args: [orderId, customerId, amount],
      taskQueue: "order-saga-task-queue",
      workflowId: `order-saga-${orderId}`,
      workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
    });
  }
}
