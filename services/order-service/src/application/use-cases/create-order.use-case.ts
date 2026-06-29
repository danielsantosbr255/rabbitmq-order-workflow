import { OrderEntity } from "../../domain/entities/order.entity.js";
import type { CreateOrderInputDTO, CreateOrderOutputDTO } from "../dtos/create-order.dto.js";
import type { IProductCatalog } from "../ports/product-catalog.port.js";
import type { ISagaOrchestrator } from "../ports/saga-orchestrator.port.js";

export class CreateOrderUseCase {
  constructor(
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

    // Domain validation happens here (fail-fast before touching Temporal)
    const order = OrderEntity.create({ customerId: input.customerId, items: itemsWithPrices });

    // Serialize entity data and start workflow — DB persistence happens inside the workflow
    const result = await this.sagaOrchestrator.startOrderSaga({
      orderId: order.id,
      customerId: order.customerId,
      totalAmountCents: order.totalAmount.cents,
      items: order.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPriceCents: i.unitPrice.cents,
      })),
      idempotencyKey: input.idempotencyKey,
    });

    return { orderId: order.id, status: "ACCEPTED", isNew: result.isNew };
  }
}
