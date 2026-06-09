import type { IOrderRepository, Order } from "./order.types.js";

export class OrderService {
  constructor(private readonly repository: IOrderRepository) { }

  async create(order: Order): Promise<Order> {
    return this.repository.create(order);
  }

  async getAll(): Promise<Order[]> {
    return this.repository.findAll();
  }
}
