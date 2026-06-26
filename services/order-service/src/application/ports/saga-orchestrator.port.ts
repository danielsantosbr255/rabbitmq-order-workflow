/**
 * Outbound port for SAGA orchestration.
 * Implemented by the Temporal adapter.
 */
export interface ISagaOrchestrator {
  startOrderSaga(orderId: string, customerId: string, amount: number): Promise<void>;
}
