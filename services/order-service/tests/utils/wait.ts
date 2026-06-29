export async function waitForOrderStatus(
  fetchOrderFn: () => Promise<{ status: string } | null>,
  expectedStatus: string,
  maxAttempts = 15,
  delayMs = 1000,
): Promise<{ status: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const order = await fetchOrderFn();
    if (order && order.status === expectedStatus) {
      return order as { status: string };
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timeout waiting for order to reach status ${expectedStatus}`);
}
