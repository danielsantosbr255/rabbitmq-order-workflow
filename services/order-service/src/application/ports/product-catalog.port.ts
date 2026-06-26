/**
 * Outbound port for fetching product prices from an external catalog.
 * Implemented by a mock adapter for now; in production would call a real product service.
 */
export interface IProductCatalog {
  getProductPrice(productId: string): Promise<number>;
}
