import { Client, Connection, WorkflowExecutionAlreadyStartedError, WorkflowIdReusePolicy } from "@temporalio/client";
import type {
  ISagaOrchestrator,
  StartOrderSagaInput,
  StartOrderSagaResult,
} from "../../../application/ports/saga-orchestrator.port.js";
import { OrderSagaWorkflow } from "./workflows.js";

export class TemporalSagaAdapter implements ISagaOrchestrator {
  private constructor(private readonly client: Client) {}

  static async createAndConnect(address: string): Promise<TemporalSagaAdapter> {
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });
    return new TemporalSagaAdapter(client);
  }

  async startOrderSaga(input: StartOrderSagaInput): Promise<StartOrderSagaResult> {
    try {
      await this.client.workflow.start(OrderSagaWorkflow, {
        args: [input],
        taskQueue: "order-saga-task-queue",
        workflowId: `order-saga-${input.orderId}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
      });
      return { isNew: true };
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        return { isNew: false };
      }
      throw error;
    }
  }
}
