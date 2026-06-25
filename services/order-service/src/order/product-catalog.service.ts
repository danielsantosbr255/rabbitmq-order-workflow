import { ResourceNotFoundError } from "../core/errors/app.errors.js";

export class ProductCatalogService {
  /**
   * Mocks a call to an external Product Catalog Service to get the true price of an item.
   * Returns price in cents (e.g., 1000 = $10.00).
   */
  async getProductPrice(productId: string): Promise<number> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Hardcode some prices based on the first character of the UUID to make it deterministic
    // Just for PoC purposes.
    const char = productId.charAt(0).toLowerCase();

    if (["0", "1", "2", "3"].includes(char)) return 5000; // $50.00
    if (["4", "5", "6", "7"].includes(char)) return 1500; // $15.00
    if (["8", "9", "a", "b"].includes(char)) return 12000; // $120.00
    if (["c", "d", "e", "f"].includes(char)) return 990; // $9.90

    throw new ResourceNotFoundError("Product", productId);
  }
}
