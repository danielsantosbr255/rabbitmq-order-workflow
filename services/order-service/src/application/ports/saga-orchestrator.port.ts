import type { OrderEntity } from "../../domain/entities/order.entity.js";

export interface ISagaOrchestrator {
  startOrderSaga(order: OrderEntity, idempotencyKey: string): Promise<void>;
}
