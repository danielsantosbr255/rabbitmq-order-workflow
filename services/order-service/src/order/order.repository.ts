import type { IOrderRepository, Order } from "./order.types.js";

export class OrderRepository implements IOrderRepository {
  private orders: Order[] = [];

  async create(order: Order) {
    this.orders.push(order);
    return order;
  }

  async findAll() {
    return this.orders;
  }
}
