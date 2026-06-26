import { ResourceNotFoundError } from "../../domain/exceptions/domain.errors.js";
import type { GetOrderOutputDTO } from "../dtos/get-order.dto.js";
import { toGetOrderOutputDTO } from "../dtos/order.dto-mapper.js";
import type { IOrderRepository } from "../ports/order-repository.port.js";

export class GetOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string): Promise<GetOrderOutputDTO> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new ResourceNotFoundError("Order", id);
    }

    return toGetOrderOutputDTO(order);
  }
}
