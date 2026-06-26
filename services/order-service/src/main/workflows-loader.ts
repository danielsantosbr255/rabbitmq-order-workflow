/**
 * Re-exports workflows for the Temporal Worker's workflowsPath resolution.
 * This file exists in main/ so the Worker can find it relative to its own entrypoint.
 */
export { OrderSagaWorkflow } from "../adapters/outbound/temporal/workflows.js";
