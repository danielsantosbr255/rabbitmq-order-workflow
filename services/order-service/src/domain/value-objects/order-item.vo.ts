import { isPositiveInteger, isUUID } from "../utils/guard.js";
import { Money } from "./money.vo.js";

/**
 * Value Object representing a single line item in an order.
 * Immutable and self-validating.
 */
export class OrderItem {
  private readonly _productId: string;
  private readonly _quantity: number;
  private readonly _unitPrice: Money;

  private constructor(productId: string, quantity: number, unitPrice: Money) {
    this._productId = productId;
    this._quantity = quantity;
    this._unitPrice = unitPrice;
  }

  static create(input: { productId: string; quantity: number; unitPrice: number }): OrderItem {
    if (!isUUID(input.productId)) {
      throw new Error(`OrderItem productId must be a valid UUID, received: ${String(input.productId)}`);
    }
    if (!isPositiveInteger(input.quantity)) {
      throw new Error(`OrderItem quantity must be a positive integer, received: ${String(input.quantity)}`);
    }
    const unitPrice = Money.create(input.unitPrice);
    return new OrderItem(input.productId, input.quantity, unitPrice);
  }

  static restore(input: { productId: string; quantity: number; unitPrice: number }): OrderItem {
    if (!isUUID(input.productId)) {
      throw new Error(`Cannot restore OrderItem with invalid productId: ${String(input.productId)}`);
    }
    if (!isPositiveInteger(input.quantity)) {
      throw new Error(`Cannot restore OrderItem with invalid quantity: ${String(input.quantity)}`);
    }
    const unitPrice = Money.restore(input.unitPrice);
    return new OrderItem(input.productId, input.quantity, unitPrice);
  }

  get productId(): string {
    return this._productId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  /** Returns the line total (quantity × unitPrice) */
  get lineTotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }

  equals(other: OrderItem): boolean {
    return (
      this._productId === other._productId &&
      this._quantity === other._quantity &&
      this._unitPrice.equals(other._unitPrice)
    );
  }
}
