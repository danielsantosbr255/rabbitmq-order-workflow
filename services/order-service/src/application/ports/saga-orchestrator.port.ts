export interface StartOrderSagaInput {
  orderId: string;
  customerId: string;
  totalAmountCents: number;
  items: { productId: string; quantity: number; unitPriceCents: number }[];
  idempotencyKey: string;
}

export interface StartOrderSagaResult {
  isNew: boolean;
}

export interface ISagaOrchestrator {
  startOrderSaga(input: StartOrderSagaInput): Promise<StartOrderSagaResult>;
}
