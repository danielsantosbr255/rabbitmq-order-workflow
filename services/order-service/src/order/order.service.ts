import { ResourceNotFoundError } from "../core/errors/app.errors.js";
import { startOrderSaga } from "../infra/temporal/client.js";
import { OrderEntity } from "./order.entity.js";
import type { CreateOrderBody } from "./order.schemas.js";
import type { IOrdersRepository } from "./order.types.js";

export class OrdersService {
  constructor(private readonly repository: IOrdersRepository) {}

  async create(input: CreateOrderBody, idempotencyKey: string): Promise<{ order: OrderEntity; isNew: boolean }> {
    const order = OrderEntity.create(input);

    const result = await this.repository.createWithIdempotency(order, idempotencyKey);
    if ("existingOrder" in result) {
      return { order: result.existingOrder, isNew: false };
    }

    await startOrderSaga(order.id, order.customerId, 100); // 100 is dummy amount for now
    return { order, isNew: true };
  }

  async getById(id: string): Promise<OrderEntity> {
    const order = await this.repository.findById(id);
    if (!order) throw new ResourceNotFoundError("Order", id);
    return order;
  }

  async processPaymentResult(id: string, status: "APPROVED" | "REJECTED"): Promise<OrderEntity> {
    const order = await this.getById(id);
    status === "APPROVED" ? order.markAsPaid() : order.cancel();
    return this.repository.save(order);
  }

  async processShippingResult(id: string, status: "COMPLETED" | "FAILED"): Promise<OrderEntity> {
    const order = await this.getById(id);
    status === "COMPLETED" ? order.markAsShipped() : order.cancel();
    return this.repository.save(order);
  }

  async compensateOrder(id: string): Promise<OrderEntity> {
    const order = await this.getById(id);
    order.cancel();
    return this.repository.save(order);
  }
}
