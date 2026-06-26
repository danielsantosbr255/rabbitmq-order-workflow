import { OrderEntity } from "../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../domain/exceptions/domain.errors.js";
import type { CreateOrderInputDTO, CreateOrderOutputDTO } from "../dtos/create-order.dto.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productCatalog: IProductCatalog,
    private readonly sagaOrchestrator: ISagaOrchestrator,
  ) {}

  async execute(input: CreateOrderInputDTO): Promise<CreateOrderOutputDTO> {
    const itemsWithPrices = await Promise.all(
      input.items.map(async item => {
        const unitPrice = await this.productCatalog.getProductPrice(item.productId);
        return { ...item, unitPrice };
      }),
    );

    const order = OrderEntity.create({ customerId: input.customerId, items: itemsWithPrices });

    try {
      await this.orderRepository.createWithIdempotency(order, input.idempotencyKey);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        const existingOrder = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey);
        if (existingOrder) {
          return { orderId: existingOrder.id, status: existingOrder.status, isNew: false };
        }
      }
      throw error;
    }

    await this.sagaOrchestrator.startOrderSaga(order.id, order.customerId, order.totalAmount.cents);

    return { orderId: order.id, status: order.status, isNew: true };
  }
}
