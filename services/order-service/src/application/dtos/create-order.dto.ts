export interface CreateOrderInputDTO {
  customerId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
}

export interface CreateOrderOutputDTO {
  orderId: string;
  status: "ACCEPTED";
  isNew: boolean;
}
