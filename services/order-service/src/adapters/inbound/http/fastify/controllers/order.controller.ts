import type { CreateOrderUseCase } from "../../../../../application/use-cases/create-order.use-case.js";
import type { GetOrderUseCase } from "../../../../../application/use-cases/get-order.use-case.js";
import type { CreateOrderBody, CreateOrderHeaders, OrderParams } from "../schemas/index.js";

export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
  ) {}

  async create(body: CreateOrderBody, headers: CreateOrderHeaders) {
    const result = await this.createOrderUseCase.execute({
      customerId: body.customerId,
      items: body.items,
      idempotencyKey: headers["x-idempotency-key"],
    });

    const statusCode = result.isNew ? (201 as const) : (200 as const);
    return {
      statusCode,
      body: { orderId: result.orderId, status: result.status },
    };
  }

  async getById(params: OrderParams) {
    const order = await this.getOrderUseCase.execute(params.id);
    return { statusCode: 200 as const, body: order };
  }
}
