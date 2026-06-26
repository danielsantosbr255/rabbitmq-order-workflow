import { proxyActivities } from "@temporalio/workflow";
import type { NotificationActivities, PaymentActivities, ShippingActivities } from "./activities.interfaces.js";
import type { OrderActivities } from "./activities.js";

const { updateOrderStatus } = proxyActivities<OrderActivities>({
  startToCloseTimeout: "10 seconds",
});

const payment = proxyActivities<PaymentActivities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 3 },
  taskQueue: "payment-service-task-queue",
});

const shipping = proxyActivities<ShippingActivities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 3 },
  taskQueue: "shipping-service-task-queue",
});

const notification = proxyActivities<NotificationActivities>({
  startToCloseTimeout: "10 seconds",
  taskQueue: "notification-service-task-queue",
});

export async function OrderSagaWorkflow(orderId: string, customerId: string, amount: number = 100): Promise<void> {
  let paymentProcessed = false;
  let shippingProcessed = false;

  try {
    // Step 1: Process Payment
    await payment.ProcessPayment(orderId, customerId, amount);
    paymentProcessed = true;
    await updateOrderStatus(orderId, "PAID");

    // Step 2: Ship Order
    await shipping.ShipOrder(orderId, customerId);
    shippingProcessed = true;
    await updateOrderStatus(orderId, "SHIPPED");

    // Step 3: Notify Customer (Success)
    await notification.NotifyCustomer(orderId, "Your order has been shipped successfully.");
  } catch (err) {
    // Compensation Logic
    if (shippingProcessed) {
      // In a real scenario, returning a shipped order is complex.
      // For this lab, if shipping fails, we refund.
    }

    if (paymentProcessed) {
      await payment.RefundPayment(orderId, customerId, amount);
    }

    await updateOrderStatus(orderId, "CANCELED");
    await notification.NotifyCustomer(orderId, "Your order was canceled and refunded.");

    throw err; // Rethrow to mark workflow as failed, or return to mark as success with compensation.
  }
}
