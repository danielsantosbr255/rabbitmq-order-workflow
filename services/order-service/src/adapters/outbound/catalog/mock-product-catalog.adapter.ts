import type { IProductCatalog } from "../../../application/ports/product-catalog.port.js";
import { ResourceNotFoundError } from "../../../domain/exceptions/domain.errors.js";

/**
 * Mock adapter simulating an external Product Catalog Service.
 * In production, this would call a real microservice via HTTP/gRPC.
 * Returns price in cents (e.g., 1000 = $10.00).
 */
export class MockProductCatalogAdapter implements IProductCatalog {
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
