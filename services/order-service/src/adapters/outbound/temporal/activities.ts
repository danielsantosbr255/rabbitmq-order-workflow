import type { UpdateOrderStatusUseCase } from "../../../application/use-cases/update-order-status.use-case.js";

/**
 * Creates Temporal activity functions bound to the given use-case.
 * This replaces the module-level state hack (let ordersService).
 */
export function createActivities(updateOrderStatusUseCase: UpdateOrderStatusUseCase) {
  return {
    async updateOrderStatus(orderId: string, status: "PAID" | "SHIPPED" | "CANCELED"): Promise<void> {
      await updateOrderStatusUseCase.execute(orderId, status);
    },
  };
}

export type OrderActivities = ReturnType<typeof createActivities>;
