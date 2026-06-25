import { IdempotencyConflictError, ResourceNotFoundError } from "../core/errors/app.errors.js";
import { startOrderSaga } from "../infra/temporal/client.js";
import { OrderEntity } from "./order.entity.js";
import type { CreateOrderBody } from "./order.schemas.js";
import type { IOrdersRepository } from "./order.types.js";
import type { ProductCatalogService } from "./product-catalog.service.js";

export class OrdersService {
  constructor(
    private readonly repository: IOrdersRepository,
    private readonly catalog: ProductCatalogService,
  ) {}

  async create(input: CreateOrderBody, idempotencyKey: string): Promise<{ order: OrderEntity; isNew: boolean }> {
    // Populate unit prices for each item
    const itemsWithPrices = await Promise.all(
      input.items.map(async item => {
        const unitPrice = await this.catalog.getProductPrice(item.productId);
        return { ...item, unitPrice };
      }),
    );

    const order = OrderEntity.create({
      customerId: input.customerId,
      items: itemsWithPrices,
    });

    try {
      await this.repository.createWithIdempotency(order, idempotencyKey);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        // Race condition lost, fetch the one that was saved
        const existingOrder = await this.repository.findByIdempotencyKey(idempotencyKey);
        if (existingOrder) {
          return { order: existingOrder, isNew: false };
        }
      }
      throw error;
    }

    await startOrderSaga(order.id, order.customerId, order.totalAmount);
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
