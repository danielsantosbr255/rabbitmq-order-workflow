export type Order = {
  id: string;
}

export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  findAll(): Promise<Order[]>;
}
