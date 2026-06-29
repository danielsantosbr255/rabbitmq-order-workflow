import { OrderEntity } from "../../domain/entities/order.entity.js";
import { IdempotencyConflictError } from "../../domain/exceptions/domain.errors.js";
import type { CreateOrderInputDTO, CreateOrderOutputDTO } from "../dtos/create-order.dto.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";

export class CreateOrderUseCase {
  constructor(
    private readonly productCatalog: IProductCatalog,
    private readonly sagaOrchestrator: ISagaOrchestrator,
    private readonly orderRepository: IOrderRepository,
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
      await this.sagaOrchestrator.startOrderSaga(order, input.idempotencyKey);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        const existingOrder = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey);
        if (existingOrder) {
          return { orderId: existingOrder.id, status: existingOrder.status, isNew: false };
        }
        throw new Error("Order creation is in progress but not yet committed to database. Please retry in a moment.");
      }
      throw error;
    }

    return { orderId: order.id, status: "ACCEPTED", isNew: true };
  }
}
