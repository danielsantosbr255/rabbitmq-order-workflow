export interface PaymentActivities {
  ProcessPayment(orderId: string, customerId: string, amount: number): Promise<void>;
  RefundPayment(orderId: string, customerId: string, amount: number): Promise<void>;
}

export interface ShippingActivities {
  ShipOrder(orderId: string, customerId: string): Promise<void>;
}

export interface NotificationActivities {
  NotifyCustomer(orderId: string, message: string): Promise<void>;
}

export interface CreateOrderActivityInput {
  orderId: string;
  customerId: string;
  totalAmountCents: number;
  items: { productId: string; quantity: number; unitPriceCents: number }[];
  idempotencyKey: string;
}
